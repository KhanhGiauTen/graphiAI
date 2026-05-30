from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.api_key import ApiKey
from app.models.user import User
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyRead, UsageSummary
from app.services.api_keys import create_raw_api_key, hash_api_key
from app.services.auth import get_current_user


router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyCreateResponse)
def create_api_key(
    payload: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiKeyCreateResponse:
    raw_key = create_raw_api_key()
    record = ApiKey(
        user_id=current_user.id,
        key_hash=hash_api_key(raw_key),
        name=payload.name,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return ApiKeyCreateResponse(api_key=raw_key, record=ApiKeyRead.model_validate(record))


@router.get("", response_model=list[ApiKeyRead])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApiKeyRead]:
    records = db.execute(
        select(ApiKey).where(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc())
    ).scalars()
    return [ApiKeyRead.model_validate(record) for record in records]


@router.delete("/{api_key_id}", response_model=ApiKeyRead)
def revoke_api_key(
    api_key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiKeyRead:
    record = db.get(ApiKey, api_key_id)
    if record is None or record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="API key not found")
    record.is_active = False
    db.add(record)
    db.commit()
    db.refresh(record)
    return ApiKeyRead.model_validate(record)


@router.get("/usage", response_model=UsageSummary)
def get_usage_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UsageSummary:
    active_count = db.execute(
        select(func.count()).select_from(ApiKey).where(ApiKey.user_id == current_user.id, ApiKey.is_active.is_(True))
    ).scalar_one()
    total_requests = db.execute(
        select(func.coalesce(func.sum(ApiKey.request_count), 0)).where(ApiKey.user_id == current_user.id)
    ).scalar_one()
    return UsageSummary(active_api_keys=int(active_count), total_public_api_requests=int(total_requests))
