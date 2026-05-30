from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        algorithm, salt, expected = hashed_password.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    actual = hash_password(password, salt).split("$", 2)[2]
    return hmac.compare_digest(actual, expected)


def create_access_token(user: User) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "exp": int((datetime.now(UTC) + timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS)).timestamp()),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    signature = _sign(payload_b64)
    return f"{payload_b64}.{signature}"


def decode_access_token(token: str) -> dict[str, str | int]:
    try:
        payload_b64, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if not hmac.compare_digest(_sign(payload_b64), signature):
        raise HTTPException(status_code=401, detail="Invalid token")
    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))
    if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    token = _bearer_token(authorization)
    payload = decode_access_token(token)
    user = db.get(User, str(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User | None:
    if not authorization:
        return None
    try:
        return get_current_user(authorization, db)
    except HTTPException:
        return None


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


def _sign(payload_b64: str) -> str:
    digest = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
