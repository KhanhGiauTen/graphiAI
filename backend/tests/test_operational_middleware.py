from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.middleware import RateLimitMiddleware


def test_rate_limit_middleware_returns_429_after_window_capacity() -> None:
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        enabled=True,
        requests_per_window=2,
        window_seconds=60,
        exempt_paths=[],
    )

    @app.get("/limited")
    def limited() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as client:
        first = client.get("/limited")
        second = client.get("/limited")
        third = client.get("/limited")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Rate limit exceeded"
    assert third.headers["X-RateLimit-Limit"] == "2"
    assert int(third.headers["Retry-After"]) > 0


def test_rate_limit_middleware_respects_exempt_paths() -> None:
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        enabled=True,
        requests_per_window=1,
        window_seconds=60,
        exempt_paths=["/health"],
    )

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(app) as client:
        first = client.get("/health")
        second = client.get("/health")

    assert first.status_code == 200
    assert second.status_code == 200
    assert "X-RateLimit-Limit" not in second.headers


def test_settings_parse_comma_separated_runtime_lists() -> None:
    settings = Settings(
        ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000",
        RATE_LIMIT_EXEMPT_PATHS="/health,/docs,/openapi.json",
    )

    assert settings.allowed_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
    assert settings.rate_limit_exempt_paths == ["/health", "/docs", "/openapi.json"]


def test_production_runtime_errors_reject_unsafe_defaults() -> None:
    settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="change-this-in-production",
        RATE_LIMIT_ENABLED=False,
        ALLOWED_ORIGINS="*",
    )

    errors = settings.runtime_errors()
    assert any("SECRET_KEY" in error for error in errors)
    assert any("RATE_LIMIT_ENABLED" in error for error in errors)
    assert any("ALLOWED_ORIGINS" in error for error in errors)


def test_production_runtime_errors_reject_local_origins() -> None:
    settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="not-the-default",
        RATE_LIMIT_ENABLED=True,
        ALLOWED_ORIGINS="http://localhost:3000,https://graphiai.vercel.app",
    )

    errors = settings.runtime_errors()
    assert any("deployed frontend URL" in error for error in errors)


def test_settings_normalize_postgres_urls_for_sqlalchemy() -> None:
    render_settings = Settings(DATABASE_URL="postgresql://user:pass@host:5432/db")
    railway_settings = Settings(DATABASE_URL="postgres://user:pass@host:5432/db")

    assert render_settings.sqlalchemy_database_url == "postgresql+psycopg2://user:pass@host:5432/db"
    assert railway_settings.sqlalchemy_database_url == "postgresql+psycopg2://user:pass@host:5432/db"
    assert render_settings.database_backend == "postgresql"
