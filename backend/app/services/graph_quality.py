from __future__ import annotations

from app.schemas.dataset import ColumnProfile, DatasetProfile
from app.schemas.graph import GraphSchema
from app.schemas.quality import GraphQualityReport, HealthCheck, QualityComponentScores, Suitability


LEAKAGE_NAME_PATTERNS = {
    "chargeback_date": "future outcome date",
    "refund_date": "future outcome date",
    "resolved_at": "future resolution timestamp",
    "refund_amount": "post-outcome amount",
    "chargeback_amount": "post-outcome amount",
    "final_status": "post-event status",
    "resolution": "post-event status",
    "dispute_result": "post-event outcome",
}


class GraphQualityScorer:
    def assess(
        self,
        profile: DatasetProfile,
        schema: GraphSchema | None = None,
    ) -> GraphQualityReport:
        id_columns = [column for column in profile.columns if column.inferred_role == "id"]
        feature_columns = [
            column
            for column in profile.columns
            if column.inferred_role in {"numerical", "categorical", "timestamp", "text"}
        ]
        label_columns = [column for column in profile.columns if column.inferred_role == "label"]

        component_scores = QualityComponentScores(
            entity_confidence=self._entity_confidence(id_columns),
            relationship_confidence=self._relationship_confidence(id_columns, schema),
            feature_richness=self._feature_richness(feature_columns, profile.column_count),
            task_suitability=self._task_suitability(profile, schema),
            connectivity_estimate=self._connectivity_estimate(id_columns),
            interpretability=self._interpretability(id_columns, schema),
        )
        final_score = self._weighted_score(component_scores)
        suitability = self._suitability(final_score, id_columns)

        leakage_warnings = self._leakage_warnings(profile)
        health_checks = self._health_checks(profile, id_columns, feature_columns, label_columns)
        warnings = self._warnings(profile, id_columns, feature_columns, leakage_warnings, health_checks)
        strengths = self._strengths(profile, schema, id_columns, feature_columns, component_scores)
        weaknesses = self._weaknesses(id_columns, feature_columns, component_scores, health_checks)

        return GraphQualityReport(
            final_score=round(final_score, 2),
            suitability=suitability,
            component_scores=component_scores,
            strengths=strengths,
            weaknesses=weaknesses,
            warnings=warnings,
            leakage_warnings=leakage_warnings,
            health_checks=health_checks,
            explanation=self._explanation(suitability, final_score, id_columns, schema),
        )

    def _entity_confidence(self, id_columns: list[ColumnProfile]) -> float:
        if not id_columns:
            return 0.0

        named_id_bonus = min(len(id_columns) / 4, 1.0) * 0.45
        repeated_ids = [column for column in id_columns if 0.01 <= column.cardinality_ratio <= 0.95]
        repeat_bonus = min(len(repeated_ids) / max(len(id_columns), 1), 1.0) * 0.45
        transaction_id_bonus = 0.10 if any(column.cardinality_ratio > 0.95 for column in id_columns) else 0.0
        return min(named_id_bonus + repeat_bonus + transaction_id_bonus, 1.0)

    def _relationship_confidence(
        self,
        id_columns: list[ColumnProfile],
        schema: GraphSchema | None,
    ) -> float:
        if len(id_columns) < 2:
            return 0.05
        if schema and schema.edge_types:
            return min(0.45 + len(schema.edge_types) * 0.12, 1.0)
        return min(0.35 + len(id_columns) * 0.10, 0.85)

    def _feature_richness(self, feature_columns: list[ColumnProfile], column_count: int) -> float:
        if not feature_columns:
            return 0.0
        density = len(feature_columns) / max(column_count, 1)
        return min(0.35 + len(feature_columns) * 0.12 + density * 0.25, 1.0)

    def _task_suitability(self, profile: DatasetProfile, schema: GraphSchema | None) -> float:
        score = 0.20
        if profile.label_columns:
            score += 0.35
        if profile.has_timestamps:
            score += 0.15
        if schema and schema.suggested_tasks:
            score += min(len(schema.suggested_tasks) * 0.10, 0.30)
        return min(score, 1.0)

    def _connectivity_estimate(self, id_columns: list[ColumnProfile]) -> float:
        if len(id_columns) < 2:
            return 0.05

        repeated = [column for column in id_columns if column.cardinality_ratio <= 0.95]
        if not repeated:
            return 0.20

        repeat_strength = sum(1.0 - column.cardinality_ratio for column in repeated) / len(repeated)
        return min(0.35 + repeat_strength * 0.75, 1.0)

    def _interpretability(self, id_columns: list[ColumnProfile], schema: GraphSchema | None) -> float:
        node_count = len(schema.node_types) if schema else len(id_columns)
        edge_count = len(schema.edge_types) if schema else max(len(id_columns) - 1, 0)

        if node_count == 0:
            return 0.0
        if node_count <= 4 and edge_count <= max(node_count * 2, 1):
            return 0.90
        if node_count <= 7:
            return 0.70
        return 0.45

    def _weighted_score(self, scores: QualityComponentScores) -> float:
        return (
            scores.entity_confidence * 0.25
            + scores.relationship_confidence * 0.20
            + scores.feature_richness * 0.20
            + scores.task_suitability * 0.15
            + scores.connectivity_estimate * 0.10
            + scores.interpretability * 0.10
        ) * 100

    def _suitability(self, final_score: float, id_columns: list[ColumnProfile]) -> Suitability:
        if len(id_columns) < 2:
            return "not_recommended" if final_score < 40 else "weak_graph_signal"
        if final_score >= 75:
            return "recommended"
        if final_score >= 55:
            return "promising_but_review"
        if final_score >= 35:
            return "weak_graph_signal"
        return "not_recommended"

    def _leakage_warnings(self, profile: DatasetProfile) -> list[str]:
        warnings: list[str] = []
        for column in profile.columns:
            normalized = column.name.lower()
            for pattern, reason in LEAKAGE_NAME_PATTERNS.items():
                if pattern in normalized:
                    warnings.append(
                        f"`{column.name}` looks like a {reason} and may leak target information."
                    )
                    break
        return warnings

    def _health_checks(
        self,
        profile: DatasetProfile,
        id_columns: list[ColumnProfile],
        feature_columns: list[ColumnProfile],
        label_columns: list[ColumnProfile],
    ) -> list[HealthCheck]:
        checks = [
            self._entity_check(id_columns),
            self._feature_check(feature_columns),
            self._missingness_check(profile),
        ]

        if profile.has_timestamps:
            checks.append(
                HealthCheck(
                    name="temporal_ordering",
                    status="warning",
                    message="Timestamped data should use time-aware splits to avoid future leakage.",
                )
            )

        checks.extend(self._label_checks(label_columns))
        checks.extend(self._cardinality_checks(profile.columns))
        return checks

    def _entity_check(self, id_columns: list[ColumnProfile]) -> HealthCheck:
        if len(id_columns) >= 2:
            return HealthCheck(
                name="entity_columns",
                status="pass",
                message=f"Found {len(id_columns)} entity-like ID columns for graph construction.",
            )
        return HealthCheck(
            name="entity_columns",
            status="fail",
            message="Fewer than 2 entity-like ID columns were found, so graph structure may be trivial.",
        )

    def _feature_check(self, feature_columns: list[ColumnProfile]) -> HealthCheck:
        if feature_columns:
            return HealthCheck(
                name="feature_columns",
                status="pass",
                message=f"Found {len(feature_columns)} candidate feature columns.",
            )
        return HealthCheck(
            name="feature_columns",
            status="warning",
            message="No feature columns were found; graph baselines may rely mostly on structure.",
        )

    def _missingness_check(self, profile: DatasetProfile) -> HealthCheck:
        if profile.total_missing_rate >= 0.20:
            status = "fail"
        elif profile.total_missing_rate >= 0.05:
            status = "warning"
        else:
            status = "pass"
        return HealthCheck(
            name="missing_values",
            status=status,
            message=f"Dataset missing rate is {profile.total_missing_rate:.1%}.",
        )

    def _label_checks(self, label_columns: list[ColumnProfile]) -> list[HealthCheck]:
        checks: list[HealthCheck] = []
        for column in label_columns:
            if not column.value_counts:
                continue

            total = sum(column.value_counts.values())
            if total == 0:
                continue

            minority_ratio = min(column.value_counts.values()) / total
            if minority_ratio < 0.05:
                status = "warning"
                message = (
                    f"`{column.name}` is highly imbalanced; minority class is {minority_ratio:.1%}."
                )
            elif minority_ratio < 0.20:
                status = "warning"
                message = f"`{column.name}` is moderately imbalanced; minority class is {minority_ratio:.1%}."
            else:
                status = "pass"
                message = f"`{column.name}` label distribution looks usable."

            checks.append(HealthCheck(name=f"label_balance:{column.name}", status=status, message=message))
        return checks

    def _cardinality_checks(self, columns: list[ColumnProfile]) -> list[HealthCheck]:
        checks: list[HealthCheck] = []
        for column in columns:
            if column.inferred_role == "id":
                continue
            if column.cardinality_ratio > 0.95:
                checks.append(
                    HealthCheck(
                        name=f"high_cardinality:{column.name}",
                        status="warning",
                        message=f"`{column.name}` has very high cardinality and may need encoding or exclusion.",
                    )
                )
        return checks

    def _warnings(
        self,
        profile: DatasetProfile,
        id_columns: list[ColumnProfile],
        feature_columns: list[ColumnProfile],
        leakage_warnings: list[str],
        health_checks: list[HealthCheck],
    ) -> list[str]:
        warnings = list(leakage_warnings)
        if len(id_columns) < 2:
            warnings.append("Dataset has fewer than 2 entity ID columns; graph modeling may not add value.")
        if id_columns and all(column.cardinality_ratio > 0.95 for column in id_columns):
            warnings.append("All ID columns are almost unique; repeated relationships may be weak.")
        if not feature_columns:
            warnings.append("No feature columns were detected for downstream ML baselines.")
        if profile.has_timestamps:
            warnings.append("Use time-aware splits for timestamped data to reduce leakage risk.")

        warnings.extend(check.message for check in health_checks if check.status in {"warning", "fail"})
        return _dedupe(warnings)

    def _strengths(
        self,
        profile: DatasetProfile,
        schema: GraphSchema | None,
        id_columns: list[ColumnProfile],
        feature_columns: list[ColumnProfile],
        scores: QualityComponentScores,
    ) -> list[str]:
        strengths: list[str] = []
        if len(id_columns) >= 2:
            strengths.append(f"Detected {len(id_columns)} entity-like columns that can form relationships.")
        if feature_columns:
            strengths.append(f"Detected {len(feature_columns)} candidate feature columns for modeling.")
        if profile.label_columns:
            strengths.append("Label column is available, enabling supervised baseline evaluation.")
        if schema and schema.edge_types:
            strengths.append(f"Selected schema defines {len(schema.edge_types)} relationship type(s).")
        if scores.interpretability >= 0.8:
            strengths.append("Schema complexity is still easy to explain.")
        return strengths

    def _weaknesses(
        self,
        id_columns: list[ColumnProfile],
        feature_columns: list[ColumnProfile],
        scores: QualityComponentScores,
        health_checks: list[HealthCheck],
    ) -> list[str]:
        weaknesses: list[str] = []
        if len(id_columns) < 2:
            weaknesses.append("The dataset does not expose enough entity columns for a rich graph.")
        if not feature_columns:
            weaknesses.append("The graph has limited non-ID features.")
        if scores.connectivity_estimate < 0.35:
            weaknesses.append("Connectivity estimate is low; the graph may fragment heavily.")
        weaknesses.extend(check.message for check in health_checks if check.status == "fail")
        return _dedupe(weaknesses)

    def _explanation(
        self,
        suitability: Suitability,
        final_score: float,
        id_columns: list[ColumnProfile],
        schema: GraphSchema | None,
    ) -> str:
        schema_part = f" The selected schema is `{schema.name}`." if schema else ""
        entity_part = f" It found {len(id_columns)} entity-like column(s)."
        return (
            f"Graph suitability is `{suitability}` with a score of {final_score:.1f}/100."
            f"{entity_part}{schema_part} Review warnings before using this graph for ML."
        )


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result
