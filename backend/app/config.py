from functools import lru_cache
from pathlib import Path

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
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
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
    RATE_LIMIT_EXEMPT_PATHS: str = "/health,/api/v1/health,/docs,/redoc,/openapi.json"

    @property
    def allowed_origins(self) -> list[str]:
        return _split_csv(self.ALLOWED_ORIGINS)

    @property
    def rate_limit_exempt_paths(self) -> list[str]:
        return _split_csv(self.RATE_LIMIT_EXEMPT_PATHS)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod"}

    @property
    def database_backend(self) -> str:
        return self.DATABASE_URL.split(":", 1)[0]

    def runtime_warnings(self) -> list[str]:
        warnings: list[str] = []
        if self.SECRET_KEY == "change-this-in-production":
            warnings.append("SECRET_KEY is using the development default.")
        if self.AI_SCHEMA_MODE == "llm" and not self.OPENAI_API_KEY:
            warnings.append("AI_SCHEMA_MODE is llm but OPENAI_API_KEY is not configured.")
        if "*" in self.allowed_origins:
            warnings.append("ALLOWED_ORIGINS includes a wildcard origin.")
        if not self.RATE_LIMIT_ENABLED:
            warnings.append("RATE_LIMIT_ENABLED is disabled.")
        if self.is_production and self.database_backend == "sqlite":
            warnings.append("Production environment is using SQLite metadata storage.")
        return warnings

    def runtime_errors(self) -> list[str]:
        if not self.is_production:
            return []

        errors: list[str] = []
        if self.SECRET_KEY == "change-this-in-production":
            errors.append("Set a non-default SECRET_KEY before running in production.")
        if not self.RATE_LIMIT_ENABLED:
            errors.append("Enable RATE_LIMIT_ENABLED before running in production.")
        if "*" in self.allowed_origins:
            errors.append("Remove wildcard ALLOWED_ORIGINS before running in production.")
        return errors

    def assert_runtime_ready(self) -> None:
        errors = self.runtime_errors()
        if errors:
            raise RuntimeError("Invalid runtime configuration: " + " ".join(errors))


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
