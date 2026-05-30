from app.schemas.dataset import ColumnProfile, DatasetProfile
from app.schemas.graph import EdgeType, GraphSchema, NodeType
from app.services.graph_quality import GraphQualityScorer


def column(
    name: str,
    role: str,
    unique_ratio: float,
    *,
    dtype: str = "object",
    value_counts: dict[str, int] | None = None,
) -> ColumnProfile:
    return ColumnProfile(
        name=name,
        dtype=dtype,
        null_count=0,
        null_rate=0.0,
        unique_count=max(1, int(unique_ratio * 1000)),
        cardinality_ratio=unique_ratio,
        sample_values=["sample"],
        value_counts=value_counts,
        inferred_role=role,  # type: ignore[arg-type]
    )


def fraud_profile() -> DatasetProfile:
    columns = [
        column("user_id", "id", 0.20),
        column("transaction_id", "id", 1.00),
        column("merchant_id", "id", 0.05),
        column("device_id", "id", 0.10),
        column("amount", "numerical", 0.70, dtype="float64"),
        column("timestamp", "timestamp", 0.80),
        column("is_fraud", "label", 0.002, dtype="int64", value_counts={"0": 980, "1": 20}),
    ]
    return DatasetProfile(
        filename="fraud_transactions.csv",
        row_count=1000,
        column_count=len(columns),
        total_missing_rate=0.01,
        memory_usage_mb=0.5,
        columns=columns,
        id_columns=["user_id", "transaction_id", "merchant_id", "device_id"],
        label_columns=["is_fraud"],
        has_timestamps=True,
    )


def fraud_schema() -> GraphSchema:
    return GraphSchema(
        id="transaction_centered",
        name="Transaction-centered fraud graph",
        description="Connect users, merchants, and devices through transaction events.",
        node_types=[
            NodeType(name="User", source_column="user_id", reasoning="User entity."),
            NodeType(name="Transaction", source_column="transaction_id", reasoning="Event entity."),
            NodeType(name="Merchant", source_column="merchant_id", reasoning="Merchant entity."),
            NodeType(name="Device", source_column="device_id", reasoning="Device entity."),
        ],
        edge_types=[
            EdgeType(source="User", target="Transaction", relation="MADE", reasoning="User made transaction."),
            EdgeType(source="Transaction", target="Merchant", relation="PAID_TO", reasoning="Payment target."),
            EdgeType(source="Transaction", target="Device", relation="USED", reasoning="Device used."),
        ],
        suggested_tasks=["Fraud Detection", "Node Classification"],
        quality_score=0,
    )


def test_fraud_dataset_is_promising_or_recommended() -> None:
    report = GraphQualityScorer().assess(fraud_profile(), fraud_schema())

    assert report.suitability in {"recommended", "promising_but_review"}
    assert report.final_score >= 55
    assert any("imbalanced" in warning.lower() for warning in report.warnings)


def test_plain_dataset_without_entities_is_not_recommended() -> None:
    columns = [
        column("age", "numerical", 0.40, dtype="int64"),
        column("income", "numerical", 0.90, dtype="float64"),
        column("target", "label", 0.002, dtype="int64", value_counts={"0": 500, "1": 500}),
    ]
    profile = DatasetProfile(
        filename="plain_table.csv",
        row_count=1000,
        column_count=len(columns),
        total_missing_rate=0.0,
        memory_usage_mb=0.1,
        columns=columns,
        id_columns=[],
        label_columns=["target"],
    )

    report = GraphQualityScorer().assess(profile)

    assert report.suitability in {"weak_graph_signal", "not_recommended"}
    assert any("fewer than 2 entity" in warning.lower() for warning in report.warnings)


def test_leakage_columns_are_flagged() -> None:
    profile = fraud_profile()
    profile.columns.append(column("chargeback_date", "timestamp", 0.30))
    profile.column_count += 1

    report = GraphQualityScorer().assess(profile, fraud_schema())

    assert any("chargeback_date" in warning for warning in report.leakage_warnings)
