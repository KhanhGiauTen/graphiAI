from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.experiments import BaselineRunner, binary_metrics
from app.services.profiler import DataProfiler
from app.services.schema_recommender import RuleBasedSchemaRecommender


FIXTURE_DIR = Path(__file__).parent / "fixtures"
FRAUD_CSV = FIXTURE_DIR / "fraud_transactions.csv"
RATINGS_CSV = FIXTURE_DIR / "user_ratings.csv"


def test_binary_metrics_handles_positive_class() -> None:
    metrics = binary_metrics(
        y_true=["1", "0", "1", "0"],
        y_pred=["1", "0", "0", "0"],
        positive_label="1",
    )

    assert metrics.accuracy == 0.75
    assert metrics.precision == 1.0
    assert metrics.recall == 0.5
    assert metrics.f1 == 0.6667


def test_baseline_runner_uses_labels_and_schema_features() -> None:
    profile = DataProfiler().profile(str(FRAUD_CSV))
    schema = RuleBasedSchemaRecommender().recommend(profile)[0]
    response = BaselineRunner().run(
        filepath=str(FRAUD_CSV),
        max_rows=5000,
        positive_label=None,
        project_id="local-test",
        schema=schema,
        test_size=0.3,
    )

    assert response.mode == "supervised_classification"
    assert response.metrics is not None
    assert response.rule is not None
    assert response.target["label_column"] == "is_fraud"
    assert response.metrics.support > 0
    assert "1" in response.label_distribution
    assert response.top_predictions
    assert any("amount" in prediction.features for prediction in response.top_predictions)


def test_baseline_runner_falls_back_to_degree_ranking_without_labels() -> None:
    profile = DataProfiler().profile(str(RATINGS_CSV))
    schema = RuleBasedSchemaRecommender().recommend(profile)[0]
    response = BaselineRunner().run(
        filepath=str(RATINGS_CSV),
        max_rows=5000,
        positive_label=None,
        project_id="local-test",
        schema=schema,
        test_size=0.3,
    )

    assert response.mode == "unsupervised_degree_ranking"
    assert response.metrics is None
    assert response.top_predictions
    assert "No label column" in response.summary


def test_baseline_endpoint_runs_after_upload_profile_and_schema() -> None:
    with TestClient(app) as client:
        upload_response = client.post(
            "/api/v1/upload",
            files={"file": ("fraud_transactions.csv", FRAUD_CSV.read_bytes(), "text/csv")},
        )
        assert upload_response.status_code == 200
        project_id = upload_response.json()["project_id"]

        assert client.post(f"/api/v1/profile/{project_id}").status_code == 200
        schema_response = client.post(f"/api/v1/schema/recommend/{project_id}")
        assert schema_response.status_code == 200
        schema_id = schema_response.json()[0]["id"]

        baseline_response = client.post(
            f"/api/v1/experiments/baseline/{project_id}",
            json={"schema_id": schema_id, "test_size": 0.3},
        )

    assert baseline_response.status_code == 200
    body = baseline_response.json()
    assert body["mode"] == "supervised_classification"
    assert body["metrics"]["support"] > 0
    assert body["rule"]["feature"]
