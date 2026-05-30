from fastapi.testclient import TestClient

from app.main import app


def test_demo_dataset_catalog_lists_supported_examples() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/demo-datasets")

    assert response.status_code == 200
    dataset_ids = {dataset["id"] for dataset in response.json()}
    assert {"fraud_transactions", "user_ratings", "student_courses"}.issubset(dataset_ids)


def test_demo_dataset_creates_schema_ready_project() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/demo-datasets/fraud_transactions/project")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "schema_recommended"
        assert payload["dataset"]["id"] == "fraud_transactions"

        project_response = client.get(f"/api/v1/projects/{payload['project_id']}")

    assert project_response.status_code == 200
    project = project_response.json()
    assert project["name"] == "Demo - Fraud Transactions"
    assert project["dataset_profile"]["row_count"] == 10
    assert project["graph_schemas"][0]["id"] == "rule_transaction_centered"


def test_demo_dataset_unknown_id_returns_404() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/demo-datasets/unknown/project")

    assert response.status_code == 404
