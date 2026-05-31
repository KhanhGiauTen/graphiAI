from fastapi.testclient import TestClient

from app.main import app


def test_health_check() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_versioned_health_check() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["version"] == "0.1.0"


def test_operational_headers_are_added() -> None:
    with TestClient(app) as client:
        response = client.get("/health", headers={"X-Request-ID": "test-request-1"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "test-request-1"
    assert "X-Process-Time-Ms" in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_system_status_reports_runtime_configuration() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/system/status")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["database_backend"] == "sqlite"
    assert body["rate_limit_enabled"] is True
    assert "http://127.0.0.1:3000" in body["allowed_origins"]
