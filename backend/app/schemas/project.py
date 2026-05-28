from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ProjectRead(BaseModel):
    id: str
    name: str | None = None
    original_filename: str | None = None
    file_size_bytes: int | None = None
    status: str
    selected_schema_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: dict[str, Any] | None = None
