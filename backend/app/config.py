from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_PATH = BASE_DIR / "graphify.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "Graphify AI"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    EXPORT_DIR: str = str(BASE_DIR / "exports")
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    AI_SCHEMA_MODE: str = "heuristic"
    LLM_MODEL: str = "local-heuristic"
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_API_KEY: str | None = None
    LLM_TIMEOUT_SECONDS: float = 20.0
    LLM_MAX_RETRIES: int = 2
    SECRET_KEY: str = "change-this-in-production"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 604800
    REQUEST_LOGGING_ENABLED: bool = True
    SECURITY_HEADERS_ENABLED: bool = True
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 600
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_EXEMPT_PATHS: list[str] = [
        "/health",
        "/api/v1/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("RATE_LIMIT_EXEMPT_PATHS", mode="before")
    @classmethod
    def parse_rate_limit_exempt_paths(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [path.strip() for path in value.split(",") if path.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
