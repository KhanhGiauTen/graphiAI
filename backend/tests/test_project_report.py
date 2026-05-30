from fastapi.testclient import TestClient

from app.main import app


def test_project_report_returns_quality_and_next_steps() -> None:
    with TestClient(app) as client:
        demo_response = client.post("/api/v1/demo-datasets/fraud_transactions/project")
        assert demo_response.status_code == 200
        project_id = demo_response.json()["project_id"]

        report_response = client.get(f"/api/v1/projects/{project_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["project_id"] == project_id
    assert report["schema_name"] == "Transaction-Centered Graph"
    assert report["overview"]["row_count"] == 10
    assert report["quality"]["final_score"] > 0
    assert report["recommendations"]
    assert any("baseline" in step.lower() for step in report["next_steps"])


def test_project_report_requires_existing_schema() -> None:
    with TestClient(app) as client:
        demo_response = client.post("/api/v1/demo-datasets/user_ratings/project")
        project_id = demo_response.json()["project_id"]

        report_response = client.get(
            f"/api/v1/projects/{project_id}/report",
            params={"schema_id": "missing_schema"},
        )

    assert report_response.status_code == 404
