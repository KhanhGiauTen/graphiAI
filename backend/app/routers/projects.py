from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.project import ProjectDetail, ProjectRead
from app.services.projects import get_project_or_404, parse_profile, parse_schemas


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    data = ProjectRead.model_validate(project).model_dump()
    return ProjectDetail(
        **data,
        dataset_profile=parse_profile(project),
        graph_schemas=parse_schemas(project),
    )
