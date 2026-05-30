from datetime import datetime

from pydantic import BaseModel, Field


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class ApiKeyRead(BaseModel):
    id: str
    name: str
    is_active: bool
    request_count: int
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreateResponse(BaseModel):
    api_key: str
    record: ApiKeyRead


class UsageSummary(BaseModel):
    active_api_keys: int
    total_public_api_requests: int
