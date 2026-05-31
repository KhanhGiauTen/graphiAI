from fastapi import APIRouter

from app.config import settings


router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/system/status")
def system_status() -> dict[str, object]:
    runtime_errors = settings.runtime_errors()
    return {
        "status": "ready" if not runtime_errors else "misconfigured",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database_backend": settings.database_backend,
        "ai_schema_mode": settings.AI_SCHEMA_MODE,
        "rate_limit_enabled": settings.RATE_LIMIT_ENABLED,
        "security_headers_enabled": settings.SECURITY_HEADERS_ENABLED,
        "allowed_origins": settings.allowed_origins,
        "runtime_warnings": settings.runtime_warnings(),
        "runtime_errors": runtime_errors,
    }
