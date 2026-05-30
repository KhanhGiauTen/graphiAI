from __future__ import annotations

import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any

import networkx as nx
import pandas as pd

from app.schemas.experiment import (
    BaselineMetrics,
    BaselinePrediction,
    BaselineRule,
    BaselineRunResponse,
)
from app.schemas.graph import GraphSchema
from app.services.code_generator import label_columns_from_frame, label_target_node_type
from app.services.graph_builder import node_id


@dataclass(frozen=True)
class FeatureRow:
    node_id: str
    node_type: str
    label: str | None
    features: dict[str, float]


class BaselineRunner:
    def run(
        self,
        *,
        filepath: str,
        max_rows: int,
        positive_label: str | None,
        project_id: str,
        schema: GraphSchema,
        test_size: float,
    ) -> BaselineRunResponse:
        df = pd.read_csv(filepath)
        warnings: list[str] = []
        if len(df) > max_rows:
            df = df.sample(n=max_rows, random_state=42)
            warnings.append(f"Dataset was sampled to {max_rows} rows for the local baseline run.")

        graph = self._build_graph(df, schema)
        labels = label_columns_from_frame(df)
        if not labels:
            return self._unsupervised_response(project_id, schema, graph, warnings, "No label column was detected.")

        target_column = labels[0]
        target_node_type = label_target_node_type(schema, df)
        rows = self._feature_rows(
            df,
            graph,
            target_node_type.name,
            target_node_type.source_column,
            target_node_type.feature_columns,
            target_column,
        )
        labeled_rows = [row for row in rows if row.label is not None]
        label_distribution = dict(Counter(row.label or "" for row in labeled_rows))

        if len(labeled_rows) < 6 or len(label_distribution) < 2:
            warnings.append("Not enough labeled nodes for a train/test classification baseline.")
            return self._unsupervised_response(project_id, schema, graph, warnings, "Labeled data was too sparse.")

        resolved_positive = positive_label or self._default_positive_label(label_distribution)
        if resolved_positive not in label_distribution:
            warnings.append(f"Requested positive label `{resolved_positive}` was not present; using minority label instead.")
            resolved_positive = self._default_positive_label(label_distribution)

        train_rows, test_rows = self._stratified_split(labeled_rows, test_size)
        if not train_rows or not test_rows or len({row.label for row in train_rows}) < 2:
            warnings.append("Train/test split did not contain enough label diversity.")
            return self._unsupervised_response(project_id, schema, graph, warnings, "Classification split was not viable.")

        rule = self._fit_threshold_rule(train_rows, resolved_positive)
        metrics, predictions = self._evaluate(test_rows, rule, resolved_positive)
        summary = (
            f"Degree-threshold baseline predicted `{target_column}` on `{target_node_type.name}` nodes "
            f"with F1={metrics.f1:.3f} and accuracy={metrics.accuracy:.3f}."
        )

        return BaselineRunResponse(
            project_id=project_id,
            schema_id=schema.id,
            mode="supervised_classification",
            model_name="Degree Threshold Baseline",
            target={
                "label_column": target_column,
                "node_type": target_node_type.name,
                "source_column": target_node_type.source_column,
            },
            metrics=metrics,
            rule=rule,
            label_distribution=label_distribution,
            top_predictions=predictions,
            warnings=warnings,
            summary=summary,
        )

    def _build_graph(self, df: pd.DataFrame, schema: GraphSchema) -> nx.MultiDiGraph:
        graph = nx.MultiDiGraph()
        for _, row in df.iterrows():
            for node_type in schema.node_types:
                value = row.get(node_type.source_column)
                if pd.isna(value):
                    continue
                graph.add_node(node_id(node_type.name, value), node_type=node_type.name)
            for edge_type in schema.edge_types:
                if len(edge_type.source_columns) < 2:
                    continue
                source_column, target_column = edge_type.source_columns[:2]
                source_value = row.get(source_column)
                target_value = row.get(target_column)
                if pd.isna(source_value) or pd.isna(target_value):
                    continue
                graph.add_edge(
                    node_id(edge_type.source, source_value),
                    node_id(edge_type.target, target_value),
                    relation=edge_type.relation,
                )
        return graph

    def _feature_rows(
        self,
        df: pd.DataFrame,
        graph: nx.MultiDiGraph,
        target_node_type: str,
        target_source_column: str,
        target_feature_columns: list[str],
        target_column: str,
    ) -> list[FeatureRow]:
        by_node: dict[str, FeatureRow] = {}
        for _, row in df.iterrows():
            source_value = row.get(target_source_column)
            label_value = row.get(target_column)
            if pd.isna(source_value):
                continue
            current_node_id = node_id(target_node_type, source_value)
            features = {
                "in_degree": float(graph.in_degree(current_node_id)),
                "out_degree": float(graph.out_degree(current_node_id)),
                "total_degree": float(graph.degree(current_node_id)),
            }
            for feature_column in target_feature_columns:
                if feature_column in df.columns:
                    feature_value = numeric_value(row.get(feature_column))
                    if feature_value is not None:
                        features[feature_column] = feature_value
            for relation, count in self._relation_counts(graph, current_node_id).items():
                features[f"relation_{relation.lower()}"] = float(count)
            by_node[current_node_id] = FeatureRow(
                node_id=current_node_id,
                node_type=target_node_type,
                label=None if pd.isna(label_value) else str(label_value),
                features=features,
            )
        return list(by_node.values())

    def _relation_counts(self, graph: nx.MultiDiGraph, current_node_id: str) -> dict[str, int]:
        counts: dict[str, int] = defaultdict(int)
        for _, _, attrs in graph.in_edges(current_node_id, data=True):
            counts[str(attrs.get("relation", "RELATED_TO"))] += 1
        for _, _, attrs in graph.out_edges(current_node_id, data=True):
            counts[str(attrs.get("relation", "RELATED_TO"))] += 1
        return dict(counts)

    def _stratified_split(self, rows: list[FeatureRow], test_size: float) -> tuple[list[FeatureRow], list[FeatureRow]]:
        rng = random.Random(42)
        by_label: dict[str, list[FeatureRow]] = defaultdict(list)
        for row in rows:
            by_label[row.label or ""].append(row)

        train_rows: list[FeatureRow] = []
        test_rows: list[FeatureRow] = []
        for label_rows in by_label.values():
            shuffled = list(label_rows)
            rng.shuffle(shuffled)
            test_count = max(1, round(len(shuffled) * test_size))
            if len(shuffled) - test_count < 1 and len(shuffled) > 1:
                test_count = len(shuffled) - 1
            test_rows.extend(shuffled[:test_count])
            train_rows.extend(shuffled[test_count:])
        rng.shuffle(train_rows)
        rng.shuffle(test_rows)
        return train_rows, test_rows

    def _fit_threshold_rule(self, rows: list[FeatureRow], positive_label: str) -> BaselineRule:
        feature_names = sorted({feature for row in rows for feature in row.features})
        negative_label = self._default_negative_label(rows, positive_label)
        best_rule = BaselineRule(
            feature="total_degree",
            threshold=0,
            direction="gte",
            negative_label=negative_label,
            train_f1=0,
            train_accuracy=0,
        )
        for feature in feature_names:
            values = sorted({row.features.get(feature, 0.0) for row in rows})
            for threshold in values:
                for direction in ("gte", "lte"):
                    predictions = [
                        self._predict_label(row, feature, threshold, direction, positive_label, negative_label)
                        for row in rows
                    ]
                    metrics = binary_metrics(
                        y_true=[row.label or "" for row in rows],
                        y_pred=predictions,
                        positive_label=positive_label,
                    )
                    if (metrics.f1, metrics.accuracy) > (best_rule.train_f1, best_rule.train_accuracy):
                        best_rule = BaselineRule(
                            feature=feature,
                            threshold=float(threshold),
                            direction=direction,  # type: ignore[arg-type]
                            negative_label=negative_label,
                            train_f1=metrics.f1,
                            train_accuracy=metrics.accuracy,
                        )
        return best_rule

    def _evaluate(
        self,
        rows: list[FeatureRow],
        rule: BaselineRule,
        positive_label: str,
    ) -> tuple[BaselineMetrics, list[BaselinePrediction]]:
        predictions = [
            self._predict_label(row, rule.feature, rule.threshold, rule.direction, positive_label, rule.negative_label)
            for row in rows
        ]
        metrics = binary_metrics(
            y_true=[row.label or "" for row in rows],
            y_pred=predictions,
            positive_label=positive_label,
        )
        top_predictions = [
            BaselinePrediction(
                node_id=row.node_id,
                node_type=row.node_type,
                score=float(row.features.get(rule.feature, 0.0)),
                predicted_label=prediction,
                true_label=row.label,
                features=row.features,
            )
            for row, prediction in zip(rows, predictions, strict=True)
        ]
        top_predictions.sort(key=lambda prediction: prediction.score, reverse=rule.direction == "gte")
        return metrics, top_predictions[:20]

    def _predict_label(
        self,
        row: FeatureRow,
        feature: str,
        threshold: float,
        direction: str,
        positive_label: str,
        negative_label: str,
    ) -> str:
        value = row.features.get(feature, 0.0)
        is_positive = value >= threshold if direction == "gte" else value <= threshold
        return positive_label if is_positive else negative_label

    def _default_positive_label(self, distribution: dict[str, int]) -> str:
        for preferred in ["1", "true", "True", "fraud", "yes", "positive"]:
            if preferred in distribution:
                return preferred
        return sorted(distribution.items(), key=lambda item: (item[1], item[0]))[0][0]

    def _default_negative_label(self, rows: list[FeatureRow], positive_label: str) -> str:
        distribution = Counter(row.label for row in rows if row.label is not None and row.label != positive_label)
        if distribution:
            return str(distribution.most_common(1)[0][0])
        return f"not_{positive_label}"

    def _unsupervised_response(
        self,
        project_id: str,
        schema: GraphSchema,
        graph: nx.MultiDiGraph,
        warnings: list[str],
        reason: str,
    ) -> BaselineRunResponse:
        ranked_nodes = sorted(graph.degree(), key=lambda item: item[1], reverse=True)[:20]
        predictions = [
            BaselinePrediction(
                node_id=str(node),
                node_type=str(graph.nodes[node].get("node_type", "Unknown")),
                score=float(degree),
                features={
                    "in_degree": float(graph.in_degree(node)),
                    "out_degree": float(graph.out_degree(node)),
                    "total_degree": float(degree),
                },
            )
            for node, degree in ranked_nodes
        ]
        return BaselineRunResponse(
            project_id=project_id,
            schema_id=schema.id,
            mode="unsupervised_degree_ranking",
            model_name="Degree Anomaly Ranking",
            target={},
            label_distribution={},
            top_predictions=predictions,
            warnings=warnings,
            summary=f"{reason} Returned top nodes by graph degree as an anomaly-style baseline.",
        )


def binary_metrics(y_true: list[str], y_pred: list[str], positive_label: str) -> BaselineMetrics:
    tp = sum(1 for actual, predicted in zip(y_true, y_pred, strict=True) if actual == positive_label and predicted == positive_label)
    tn = sum(1 for actual, predicted in zip(y_true, y_pred, strict=True) if actual != positive_label and predicted != positive_label)
    fp = sum(1 for actual, predicted in zip(y_true, y_pred, strict=True) if actual != positive_label and predicted == positive_label)
    fn = sum(1 for actual, predicted in zip(y_true, y_pred, strict=True) if actual == positive_label and predicted != positive_label)
    support = len(y_true)
    accuracy = (tp + tn) / support if support else 0.0
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return BaselineMetrics(
        accuracy=round(accuracy, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1=round(f1, 4),
        support=support,
        positive_label=positive_label,
    )


def numeric_value(value: Any) -> float | None:
    if pd.isna(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
