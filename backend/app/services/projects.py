import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.project import Project
from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema


def get_project_or_404(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def parse_profile(project: Project) -> DatasetProfile | None:
    if not project.dataset_profile_json:
        return None
    return DatasetProfile.model_validate_json(project.dataset_profile_json)


def parse_schemas(project: Project) -> list[GraphSchema]:
    if not project.graph_schemas_json:
        return []
    raw = json.loads(project.graph_schemas_json)
    return [GraphSchema.model_validate(item) for item in raw]


def select_schema(project: Project, schema_id: str | None = None) -> GraphSchema:
    schemas = parse_schemas(project)
    if not schemas:
        raise HTTPException(status_code=400, detail="No graph schemas have been generated for this project")

    selected_id = schema_id or project.selected_schema_id or schemas[0].id
    for schema in schemas:
        if schema.id == selected_id:
            return schema
    raise HTTPException(status_code=404, detail="Schema not found")
