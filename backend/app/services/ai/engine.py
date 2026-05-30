from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

from app.config import settings


TModel = TypeVar("TModel", bound=BaseModel)


class LLMUnavailableError(RuntimeError):
    """Raised when no external LLM provider is configured."""


class LLMEngine:
    """Thin provider boundary for future hosted LLM calls.

    Phase 3 keeps local behavior deterministic. If no API key is configured,
    callers should catch `LLMUnavailableError` and use heuristic fallback.
    """

    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.LLM_MODEL

    async def complete(self, system: str, user: str) -> str:
        _ = (system, user)
        if not settings.OPENAI_API_KEY:
            raise LLMUnavailableError("No external LLM provider is configured.")
        raise LLMUnavailableError("External LLM calls are not implemented in the lean local build.")

    async def complete_with_schema(
        self,
        system: str,
        user: str,
        pydantic_model: type[TModel],
    ) -> TModel:
        _ = (system, user, pydantic_model)
        if not settings.OPENAI_API_KEY:
            raise LLMUnavailableError("No external LLM provider is configured.")
        raise LLMUnavailableError("External structured LLM calls are not implemented in the lean local build.")


class LLMCallLog(BaseModel):
    provider: str
    model: str
    prompt_hash: str
    metadata: dict[str, Any] = {}
