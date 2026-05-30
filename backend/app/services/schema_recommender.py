from __future__ import annotations

from itertools import combinations

from app.schemas.dataset import ColumnProfile, DatasetProfile
from app.schemas.graph import EdgeType, GraphSchema, NodeType
from app.services.graph_quality import GraphQualityScorer


ENTITY_NAME_MAP = {
    "user_id": "User",
    "customer_id": "Customer",
    "cust_id": "Customer",
    "merchant_id": "Merchant",
    "shop_id": "Shop",
    "seller_id": "Seller",
    "product_id": "Product",
    "item_id": "Item",
    "sku": "Product",
    "transaction_id": "Transaction",
    "txn_id": "Transaction",
    "order_id": "Order",
    "device_id": "Device",
    "ip": "IPAddress",
    "ip_addr": "IPAddress",
    "student_id": "Student",
    "course_id": "Course",
    "assignment_id": "Assignment",
    "account_id": "Account",
    "card_id": "Card",
}


class RuleBasedSchemaRecommender:
    def recommend(self, profile: DatasetProfile) -> list[GraphSchema]:
        id_columns = [column for column in profile.columns if column.inferred_role == "id"]
        feature_columns = [
            column.name
            for column in profile.columns
            if column.inferred_role in {"numerical", "categorical", "timestamp"}
        ]
        schemas: list[GraphSchema] = []

        if len(id_columns) >= 2:
            schemas.append(self._minimal_bipartite(profile, id_columns, feature_columns))
        if len(id_columns) >= 3:
            schemas.append(self._transaction_centered(profile, id_columns, feature_columns))
        if len(id_columns) >= 4:
            schemas.append(self._full_heterogeneous(profile, id_columns, feature_columns))

        scored = [self._score_schema(profile, schema) for schema in schemas]
        return sorted(scored, key=lambda schema: schema.quality_score, reverse=True)[:3]

    def _minimal_bipartite(
        self,
        profile: DatasetProfile,
        id_columns: list[ColumnProfile],
        feature_columns: list[str],
    ) -> GraphSchema:
        left, right = id_columns[0], id_columns[1]
        left_name, right_name = entity_name(left.name), entity_name(right.name)
        return GraphSchema(
            id="rule_minimal_bipartite",
            name="Minimal Bipartite Graph",
            description=f"Connect {left_name} and {right_name} directly when they appear in the same row.",
            node_types=[
                NodeType(name=left_name, source_column=left.name, feature_columns=[], reasoning=f"`{left.name}` is ID-like."),
                NodeType(name=right_name, source_column=right.name, feature_columns=[], reasoning=f"`{right.name}` is ID-like."),
            ],
            edge_types=[
                EdgeType(
                    source=left_name,
                    target=right_name,
                    relation="INTERACTS_WITH",
                    source_columns=[left.name, right.name],
                    directed=False,
                    reasoning="Both entities co-occur in one record.",
                )
            ],
            suggested_tasks=suggest_tasks(profile, [left_name, right_name]),
            quality_score=0,
            strengths=["Simple and interpretable.", "Fast to preview and export."],
            weaknesses=["Drops event-centered detail from additional entity columns."],
            recommended_models=[{"name": "Node2Vec", "reason": "Simple embedding baseline for direct relationships."}],
        )

    def _transaction_centered(
        self,
        profile: DatasetProfile,
        id_columns: list[ColumnProfile],
        feature_columns: list[str],
    ) -> GraphSchema:
        transaction = transaction_column(id_columns)
        others = [column for column in id_columns if column.name != transaction.name]
        transaction_name = entity_name(transaction.name)
        node_types = [
            NodeType(
                name=transaction_name,
                source_column=transaction.name,
                feature_columns=feature_columns,
                reasoning=f"`{transaction.name}` is highly unique and works as an event node.",
            )
        ]
        node_types.extend(
            NodeType(
                name=entity_name(column.name),
                source_column=column.name,
                feature_columns=[],
                reasoning=f"`{column.name}` is ID-like and repeatedly links events.",
            )
            for column in others
        )
        edge_types = [
            EdgeType(
                source=entity_name(column.name),
                target=transaction_name,
                relation=relation_name(entity_name(column.name), transaction_name),
                source_columns=[column.name, transaction.name],
                directed=True,
                reasoning=f"Connect {entity_name(column.name)} to {transaction_name} through each row event.",
            )
            for column in others
        ]
        return GraphSchema(
            id="rule_transaction_centered",
            name="Transaction-Centered Graph",
            description=f"Use {transaction_name} as an event node and attach row-level features to it.",
            node_types=node_types,
            edge_types=edge_types,
            suggested_tasks=suggest_tasks(profile, [node.name for node in node_types]),
            quality_score=0,
            strengths=["Preserves event features.", "Strong fit for fraud or interaction datasets."],
            weaknesses=["Creates more nodes than a direct graph."],
            warnings=["Use time-aware splits when training with timestamped events."] if profile.has_timestamps else [],
            recommended_models=[{"name": "GraphSAGE", "reason": "Useful supervised baseline when labels exist."}],
        )

    def _full_heterogeneous(
        self,
        profile: DatasetProfile,
        id_columns: list[ColumnProfile],
        feature_columns: list[str],
    ) -> GraphSchema:
        node_types = [
            NodeType(
                name=entity_name(column.name),
                source_column=column.name,
                feature_columns=[],
                reasoning=f"`{column.name}` is ID-like and becomes a node type.",
            )
            for column in id_columns
        ]
        edge_types = [
            EdgeType(
                source=entity_name(left.name),
                target=entity_name(right.name),
                relation="CO_OCCURS_WITH",
                source_columns=[left.name, right.name],
                directed=False,
                reasoning="Both entity IDs appear in the same row.",
            )
            for left, right in combinations(id_columns, 2)
        ]
        schema = GraphSchema(
            id="rule_full_heterogeneous",
            name="Full Heterogeneous Graph",
            description="Represent every detected entity and connect every co-occurring entity pair.",
            node_types=node_types,
            edge_types=edge_types,
            suggested_tasks=suggest_tasks(profile, [node.name for node in node_types]),
            quality_score=0,
            strengths=["Captures the richest co-occurrence structure."],
            weaknesses=["Can become dense and harder to explain."],
            warnings=["Preview only a sample for large datasets."],
            recommended_models=[{"name": "HeteroGNN", "reason": "Useful after validating heterogeneous structure."}],
        )
        if feature_columns:
            schema.strengths.append(f"Feature columns can be assigned later: {', '.join(feature_columns[:5])}.")
        return schema

    def _score_schema(self, profile: DatasetProfile, schema: GraphSchema) -> GraphSchema:
        report = GraphQualityScorer().assess(profile, schema)
        adjustment = 0.0
        entity_names = {node.name for node in schema.node_types}
        if schema.id == "rule_transaction_centered" and {"Transaction", "Order"} & entity_names:
            adjustment += 6.0
        if schema.id == "rule_minimal_bipartite" and len(profile.id_columns) > 2:
            adjustment -= 3.0
        if schema.id == "rule_full_heterogeneous" and len(schema.edge_types) > len(schema.node_types):
            adjustment -= 4.0
        schema.quality_score = round(max(0, min(100, report.final_score + adjustment)), 2)
        schema.warnings = _dedupe([*schema.warnings, *report.warnings])
        schema.strengths = _dedupe([*schema.strengths, *report.strengths])
        schema.weaknesses = _dedupe([*schema.weaknesses, *report.weaknesses])
        return schema


def entity_name(column_name: str) -> str:
    normalized = column_name.lower()
    if normalized in ENTITY_NAME_MAP:
        return ENTITY_NAME_MAP[normalized]
    for key, value in ENTITY_NAME_MAP.items():
        if key.replace("_id", "") in normalized:
            return value
    for suffix in ["_id", "_key"]:
        if normalized.endswith(suffix):
            normalized = normalized[: -len(suffix)]
    return "".join(part.capitalize() for part in normalized.replace("-", "_").split("_") if part) or "Entity"


def transaction_column(id_columns: list[ColumnProfile]) -> ColumnProfile:
    for column in id_columns:
        if entity_name(column.name) in {"Transaction", "Order", "Assignment"}:
            return column
    return sorted(id_columns, key=lambda column: column.cardinality_ratio, reverse=True)[0]


def relation_name(source_name: str, transaction_name: str) -> str:
    if source_name in {"User", "Customer", "Account"} and transaction_name in {"Transaction", "Order"}:
        return "MADE"
    if source_name in {"Merchant", "Shop", "Seller"}:
        return "PAID_TO"
    if source_name == "Device":
        return "USED"
    if source_name == "Student":
        return "ATTEMPTED"
    return "RELATED_TO"


def suggest_tasks(profile: DatasetProfile, entity_names: list[str]) -> list[str]:
    tasks: list[str] = []
    label_text = " ".join(profile.label_columns).lower()
    if "fraud" in label_text:
        tasks.append("Fraud Detection")
    elif profile.label_columns:
        tasks.append("Node or Edge Classification")
    if any(name in entity_names for name in ["User", "Customer"]) and any(
        name in entity_names for name in ["Product", "Item"]
    ):
        tasks.append("Recommendation")
    if len(entity_names) >= 2:
        tasks.append("Link Prediction")
    if profile.has_timestamps:
        tasks.append("Temporal Graph Analysis")
    if not profile.label_columns:
        tasks.extend(["Community Detection", "Anomaly Detection"])
    return _dedupe(tasks)


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            result.append(item)
            seen.add(item)
    return result
