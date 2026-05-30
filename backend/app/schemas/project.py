from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema
from app.schemas.quality import GraphQualityReport


class ProjectRead(BaseModel):
    id: str
    name: str | None = None
    original_filename: str | None = None
    file_size_bytes: int | None = None
    status: str
    selected_schema_id: str | None = None
    user_id: str | None = None
    visibility: str = "private"
    share_token: str | None = None
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


class ProjectReportOverview(BaseModel):
    row_count: int
    column_count: int
    missing_rate: float
    id_columns: list[str]
    label_columns: list[str]
    has_timestamps: bool


class ProjectReport(BaseModel):
    project_id: str
    project_name: str | None = None
    filename: str | None = None
    generated_at: datetime
    schema_id: str
    schema_name: str
    overview: ProjectReportOverview
    node_types: list[str]
    edge_types: list[str]
    suggested_tasks: list[str]
    quality: GraphQualityReport
    recommendations: list[str]
    next_steps: list[str]


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: dict[str, Any] | None = None
