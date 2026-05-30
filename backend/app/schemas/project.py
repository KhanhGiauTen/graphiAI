from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema


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


class ProjectDetail(ProjectRead):
    dataset_profile: DatasetProfile | None = None
    graph_schemas: list[GraphSchema] = Field(default_factory=list)


class UploadResponse(BaseModel):
    project_id: str
    filename: str
    size_bytes: int
    status: str


class ExportBundle(BaseModel):
    project_id: str
    zip_path: str
    files: list[str]


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: dict[str, Any] | None = None
