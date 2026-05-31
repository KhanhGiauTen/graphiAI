from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectDetail, ProjectReport
from app.routers.projects import project_detail, project_report


router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{share_token}", response_model=ProjectDetail)
def get_shared_project(share_token: str, db: Session = Depends(get_db)) -> ProjectDetail:
    project = _shared_project_or_404(db, share_token)
    return project_detail(project)


@router.get("/{share_token}/report", response_model=ProjectReport)
def get_shared_project_report(
    share_token: str,
    schema_id: str | None = None,
    db: Session = Depends(get_db),
) -> ProjectReport:
    project = _shared_project_or_404(db, share_token)
    return project_report(project, schema_id)


def _shared_project_or_404(db: Session, share_token: str) -> Project:
    project = db.execute(select(Project).where(Project.share_token == share_token)).scalar_one_or_none()
    if project is None or project.visibility != "shared":
        raise HTTPException(status_code=404, detail="Shared project not found")
    return project
