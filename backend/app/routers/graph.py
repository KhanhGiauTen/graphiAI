from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.graph import GraphPreview
from app.services.graph_builder import GraphBuilder
from app.services.projects import get_project_or_404, select_schema


class BuildGraphRequest(BaseModel):
    schema_id: str | None = None
    sample_size: int = Field(default=500, ge=1, le=2000)


router = APIRouter(prefix="/graph", tags=["graph"])


@router.post("/build/{project_id}", response_model=GraphPreview)
def build_graph(
    project_id: str,
    request: BuildGraphRequest | None = None,
    db: Session = Depends(get_db),
) -> GraphPreview:
    project = get_project_or_404(db, project_id)
    if not project.file_path:
        raise HTTPException(status_code=400, detail="Project has no uploaded file")
    request = request or BuildGraphRequest()
    schema = select_schema(project, request.schema_id)
    project.selected_schema_id = schema.id
    db.add(project)
    db.commit()
    return GraphBuilder().build(project.file_path, schema, request.sample_size)
