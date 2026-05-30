from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services.api_keys import RATE_LIMIT_PER_MINUTE
from pathlib import Path


FRAUD_CSV = Path(__file__).parent / "fixtures" / "fraud_transactions.csv"


def register(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"api-{uuid4().hex}@example.com",
            "password": "strong-password",
            "full_name": "API User",
        },
    )
    assert response.status_code == 200
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def api_header(api_key: str) -> dict[str, str]:
    return {"X-API-Key": api_key}


def test_api_keys_are_created_hashed_listed_and_revoked() -> None:
    with TestClient(app) as client:
        user = register(client)
        headers = auth_header(user["access_token"])

        create_response = client.post("/api/v1/api-keys", headers=headers, json={"name": "CI key"})
        assert create_response.status_code == 200
        raw_key = create_response.json()["api_key"]
        assert raw_key.startswith("gai_")
        assert create_response.json()["record"]["name"] == "CI key"

        list_response = client.get("/api/v1/api-keys", headers=headers)
        assert list_response.status_code == 200
        assert raw_key not in list_response.text

        key_id = create_response.json()["record"]["id"]
        revoke_response = client.delete(f"/api/v1/api-keys/{key_id}", headers=headers)
        assert revoke_response.status_code == 200
        assert revoke_response.json()["is_active"] is False


def test_public_api_profile_schema_quality_and_usage() -> None:
    with TestClient(app) as client:
        user = register(client)
        headers = auth_header(user["access_token"])
        raw_key = client.post("/api/v1/api-keys", headers=headers, json={"name": "Public API"}).json()["api_key"]

        profile_response = client.post(
            "/public/v1/profile",
            headers=api_header(raw_key),
            files={"file": ("fraud_transactions.csv", FRAUD_CSV.read_bytes(), "text/csv")},
        )
        assert profile_response.status_code == 200
        profile = profile_response.json()
        assert "transaction_id" in profile["id_columns"]

        schema_response = client.post("/public/v1/schema/recommend", headers=api_header(raw_key), json=profile)
        assert schema_response.status_code == 200
        schemas = schema_response.json()
        assert schemas[0]["id"] == "rule_transaction_centered"

        quality_response = client.post(
            "/public/v1/quality/assess",
            headers=api_header(raw_key),
            json={"profile": profile, "schema": schemas[0]},
        )
        assert quality_response.status_code == 200
        assert quality_response.json()["final_score"] > 0

        usage_response = client.get("/api/v1/api-keys/usage", headers=headers)
        assert usage_response.status_code == 200
        assert usage_response.json()["total_public_api_requests"] >= 3


def test_public_api_rate_limit_is_enforced() -> None:
    with TestClient(app) as client:
        user = register(client)
        headers = auth_header(user["access_token"])
        raw_key = client.post("/api/v1/api-keys", headers=headers, json={"name": "Rate limit"}).json()["api_key"]

        last_response = None
        for _ in range(RATE_LIMIT_PER_MINUTE + 1):
            last_response = client.post(
                "/public/v1/profile",
                headers=api_header(raw_key),
                files={"file": ("fraud_transactions.csv", FRAUD_CSV.read_bytes(), "text/csv")},
            )

        assert last_response is not None
        assert last_response.status_code == 429
