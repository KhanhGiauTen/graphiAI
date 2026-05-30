from uuid import uuid4
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


FRAUD_CSV = Path(__file__).parent / "fixtures" / "fraud_transactions.csv"


def register(client: TestClient, email_prefix: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{email_prefix}-{uuid4().hex}@example.com",
            "password": "strong-password",
            "full_name": "Graph User",
        },
    )
    assert response.status_code == 200
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_me_flow() -> None:
    with TestClient(app) as client:
        email = f"user-{uuid4().hex}@example.com"
        register_response = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "strong-password", "full_name": "User One"},
        )
        assert register_response.status_code == 200
        token = register_response.json()["access_token"]

        me_response = client.get("/api/v1/auth/me", headers=auth_header(token))
        assert me_response.status_code == 200
        assert me_response.json()["email"] == email

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "strong-password"},
        )
        assert login_response.status_code == 200
        assert login_response.json()["user"]["email"] == email


def test_user_project_access_and_share_lifecycle() -> None:
    with TestClient(app) as client:
        owner = register(client, "owner")
        stranger = register(client, "stranger")
        owner_headers = auth_header(owner["access_token"])
        stranger_headers = auth_header(stranger["access_token"])

        upload_response = client.post(
            "/api/v1/upload",
            headers=owner_headers,
            files={"file": ("fraud_transactions.csv", FRAUD_CSV.read_bytes(), "text/csv")},
        )
        assert upload_response.status_code == 200
        project_id = upload_response.json()["project_id"]
        client.post(f"/api/v1/profile/{project_id}", headers=owner_headers)
        client.post(f"/api/v1/schema/recommend/{project_id}", headers=owner_headers)

        list_response = client.get("/api/v1/projects", headers=owner_headers)
        assert list_response.status_code == 200
        assert any(project["id"] == project_id for project in list_response.json())

        forbidden_response = client.get(f"/api/v1/projects/{project_id}", headers=stranger_headers)
        assert forbidden_response.status_code == 403

        share_response = client.post(f"/api/v1/projects/{project_id}/share", headers=owner_headers)
        assert share_response.status_code == 200
        share_token = share_response.json()["share_token"]
        assert share_token

        public_response = client.get(f"/api/v1/share/{share_token}")
        assert public_response.status_code == 200
        assert public_response.json()["id"] == project_id

        revoke_response = client.delete(f"/api/v1/projects/{project_id}/share", headers=owner_headers)
        assert revoke_response.status_code == 200

        revoked_public_response = client.get(f"/api/v1/share/{share_token}")
        assert revoked_public_response.status_code == 404


def test_login_rejects_bad_password() -> None:
    with TestClient(app) as client:
        registered = register(client, "bad-login")
        response = client.post(
            "/api/v1/auth/login",
            json={"email": registered["user"]["email"], "password": "wrong-password"},
        )

    assert response.status_code == 401
