from __future__ import annotations

import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.api_key import ApiKey


RATE_LIMIT_PER_MINUTE = 60
_request_windows: dict[str, deque[float]] = defaultdict(deque)


def create_raw_api_key() -> str:
    return f"gai_{secrets.token_urlsafe(32)}"


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}:{raw_key}".encode("utf-8")).hexdigest()


def get_api_key_record(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    db: Session = Depends(get_db),
) -> ApiKey:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header")

    key_hash = hash_api_key(x_api_key)
    record = db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    ).scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=401, detail="Invalid API key")

    _enforce_rate_limit(key_hash)
    record.last_used_at = datetime.now(UTC)
    record.request_count += 1
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _enforce_rate_limit(key_hash: str) -> None:
    now = time.time()
    window = _request_windows[key_hash]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="API rate limit exceeded")
    window.append(now)
