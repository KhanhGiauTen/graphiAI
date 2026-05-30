from __future__ import annotations

import hashlib
import json
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from app.config import settings


TModel = TypeVar("TModel", bound=BaseModel)


class LLMUnavailableError(RuntimeError):
    """Raised when no external LLM provider is configured."""


class LLMEngine:
    """OpenAI-compatible provider boundary for schema reasoning.

    If no API key is configured, callers should catch `LLMUnavailableError`
    and use the deterministic heuristic fallback.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        max_retries: int | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.base_url = (base_url or settings.OPENAI_BASE_URL).rstrip("/")
        self.max_retries = max_retries if max_retries is not None else settings.LLM_MAX_RETRIES
        self.model = model or settings.LLM_MODEL
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else settings.LLM_TIMEOUT_SECONDS
        self.call_logs: list[LLMCallLog] = []

    async def complete(self, system: str, user: str) -> str:
        if not self.api_key:
            raise LLMUnavailableError("No external LLM provider is configured.")

        prompt_hash = hash_prompt(system, user)
        self.call_logs.append(
            LLMCallLog(
                provider="openai-compatible",
                model=self.model,
                prompt_hash=prompt_hash,
                metadata={"response_format": "text"},
            )
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
        }
        response_json = await self._post_chat_completions(payload)
        return extract_message_content(response_json)

    async def complete_with_schema(
        self,
        system: str,
        user: str,
        pydantic_model: type[TModel],
    ) -> TModel:
        if not self.api_key:
            raise LLMUnavailableError("No external LLM provider is configured.")

        prompt_hash = hash_prompt(system, user)
        self.call_logs.append(
            LLMCallLog(
                provider="openai-compatible",
                model=self.model,
                prompt_hash=prompt_hash,
                metadata={
                    "response_format": "json_object",
                    "schema_model": pydantic_model.__name__,
                },
            )
        )

        schema_json = json.dumps(pydantic_model.model_json_schema(), ensure_ascii=True)
        structured_system = (
            f"{system}\n\nReturn only valid JSON matching this JSON Schema. "
            f"Do not wrap it in markdown fences.\nJSON Schema: {schema_json}"
        )
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": structured_system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        last_error: Exception | None = None
        for _ in range(max(self.max_retries, 0) + 1):
            try:
                response_json = await self._post_chat_completions(payload)
                content = extract_json_object(extract_message_content(response_json))
                return pydantic_model.model_validate_json(content)
            except (ValueError, httpx.HTTPError) as exc:
                last_error = exc
        raise LLMUnavailableError(f"Structured LLM response could not be parsed: {last_error}")

    async def _post_chat_completions(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()


class LLMCallLog(BaseModel):
    provider: str
    model: str
    prompt_hash: str
    metadata: dict[str, Any] = {}


def hash_prompt(system: str, user: str) -> str:
    return hashlib.sha256(f"{system}\n\n{user}".encode("utf-8")).hexdigest()


def extract_message_content(response_json: dict[str, Any]) -> str:
    try:
        content = response_json["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMUnavailableError("LLM response did not include a chat message.") from exc

    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = [
            item.get("text", "")
            for item in content
            if isinstance(item, dict) and item.get("type") in {"text", "output_text"}
        ]
        return "\n".join(part for part in text_parts if part)
    raise LLMUnavailableError("LLM response content is not text.")


def extract_json_object(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in LLM response.")
    return cleaned[start : end + 1]
