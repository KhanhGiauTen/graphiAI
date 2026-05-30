import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.ai_schema import AISchemaResponse
from app.schemas.dataset import ColumnProfile, DatasetProfile
from app.services.ai.engine import LLMEngine, LLMUnavailableError, extract_json_object
from app.services.ai.schema_understanding import AISchemaService, ColumnSemanticAnalyzer


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


def test_column_semantics_identify_fraud_entities_and_label() -> None:
    semantics = ColumnSemanticAnalyzer().analyze(fraud_profile())
    by_name = {column.column_name: column for column in semantics.columns}

    assert by_name["user_id"].role == "entity_id"
    assert by_name["user_id"].entity_hint == "User"
    assert by_name["merchant_id"].entity_hint == "Merchant"
    assert by_name["device_id"].entity_hint == "Device"
    assert by_name["transaction_id"].entity_hint == "Transaction"
    assert by_name["is_fraud"].role == "label"
    assert by_name["timestamp"].role == "timestamp"
    assert semantics.dataset_domain == "banking/fintech"
    assert "Fraud Detection" in semantics.potential_tasks


def test_ai_schema_service_returns_three_ranked_valid_schemas() -> None:
    response = AISchemaService().analyze(fraud_profile())
    source_columns = {column.name for column in fraud_profile().columns}

    assert response.mode == "heuristic_fallback"
    assert len(response.schemas) == 3
    assert response.schemas == sorted(response.schemas, key=lambda schema: schema.quality_score, reverse=True)
    for schema in response.schemas:
        assert schema.quality_score > 0
        for node in schema.node_types:
            assert node.source_column in source_columns
        for edge in schema.edge_types:
            assert set(edge.source_columns).issubset(source_columns)


def test_ai_schema_service_uses_valid_llm_response_and_caches_by_profile() -> None:
    class FakeEngine:
        model = "fake-valid"

        def __init__(self) -> None:
            self.calls = 0

        async def complete_with_schema(self, system: str, user: str, pydantic_model: type[AISchemaResponse]) -> AISchemaResponse:
            self.calls += 1
            response = AISchemaService().analyze(fraud_profile())
            response.mode = "llm_draft"
            response.semantics.dataset_summary = "LLM enriched fraud transaction graph."
            return response

    AISchemaService._cache.clear()
    engine = FakeEngine()
    service = AISchemaService(llm_engine=engine, mode="llm")  # type: ignore[arg-type]

    first = asyncio.run(service.analyze_async(fraud_profile()))
    second = asyncio.run(service.analyze_async(fraud_profile()))

    assert first.mode == "llm"
    assert first.semantics.dataset_summary == "LLM enriched fraud transaction graph."
    assert second.mode == "llm"
    assert engine.calls == 1


def test_ai_schema_service_falls_back_when_llm_references_unknown_columns() -> None:
    class InvalidEngine:
        model = "fake-invalid"

        async def complete_with_schema(self, system: str, user: str, pydantic_model: type[AISchemaResponse]) -> AISchemaResponse:
            response = AISchemaService().analyze(fraud_profile())
            response.schemas[0].node_types[0].source_column = "ghost_id"
            return response

    AISchemaService._cache.clear()
    service = AISchemaService(llm_engine=InvalidEngine(), mode="llm")  # type: ignore[arg-type]
    response = asyncio.run(service.analyze_async(fraud_profile()))

    assert response.mode == "heuristic_fallback"
    assert any("unknown node column" in warning for warning in response.warnings)
    assert all(node.source_column != "ghost_id" for schema in response.schemas for node in schema.node_types)


def test_event_centered_schema_is_available_for_fraud_data() -> None:
    response = AISchemaService().analyze(fraud_profile())
    schema_by_id = {schema.id: schema for schema in response.schemas}

    assert "ai_event_centered" in schema_by_id
    event_schema = schema_by_id["ai_event_centered"]
    assert any(node.name == "Transaction" and "amount" in node.feature_columns for node in event_schema.node_types)
    assert any(edge.relation == "MADE" for edge in event_schema.edge_types)


def test_schema_explanation_mentions_actual_columns_and_model() -> None:
    response = AISchemaService().analyze(fraud_profile())
    explanation = AISchemaService().explain(
        profile=fraud_profile(),
        schema=response.schemas[0],
        semantics=response.semantics,
    ).explanation

    assert "fraud_transactions.csv" in explanation
    assert "`user_id`" in explanation or "`transaction_id`" in explanation
    assert "Watch for leakage" in explanation


def test_ai_schema_analyze_endpoint_contract() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/schema/analyze", json={"profile": fraud_profile().model_dump()})

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "heuristic_fallback"
    assert len(body["schemas"]) == 3
    assert body["semantics"]["dataset_domain"] == "banking/fintech"


def test_project_ai_schema_endpoint_saves_ai_schemas() -> None:
    with TestClient(app) as client:
        upload_response = client.post(
            "/api/v1/upload",
            files={"file": ("fraud_transactions.csv", (Path(__file__).parent / "fixtures" / "fraud_transactions.csv").read_bytes(), "text/csv")},
        )
        assert upload_response.status_code == 200
        project_id = upload_response.json()["project_id"]
        assert client.post(f"/api/v1/profile/{project_id}").status_code == 200

        response = client.post(f"/api/v1/ai/schema/analyze/{project_id}")
        assert response.status_code == 200
        body = response.json()
        assert body["mode"] == "heuristic_fallback"
        assert body["schemas"][0]["id"].startswith("ai_")

        project_response = client.get(f"/api/v1/projects/{project_id}")
        assert project_response.status_code == 200
        project = project_response.json()
        assert project["status"] == "ai_schema_heuristic"
        assert project["graph_schemas"][0]["id"].startswith("ai_")


def test_ai_schema_explain_endpoint_contract() -> None:
    analysis = AISchemaService().analyze(fraud_profile())
    payload = {
        "profile": fraud_profile().model_dump(),
        "schema": analysis.schemas[0].model_dump(),
        "semantics": analysis.semantics.model_dump(),
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/ai/schema/explain", json=payload)

    assert response.status_code == 200
    assert analysis.schemas[0].name in response.json()["explanation"]


def test_llm_engine_reports_unavailable_without_provider() -> None:
    engine = LLMEngine()

    try:
        asyncio.run(engine.complete("system", "user"))
    except LLMUnavailableError as exc:
        assert "No external LLM provider" in str(exc)
    else:
        raise AssertionError("LLMEngine should fail closed when no provider is configured.")


def test_extract_json_object_accepts_markdown_wrapped_json() -> None:
    assert extract_json_object("""```json\n{"ok": true}\n```""") == '{"ok": true}'
