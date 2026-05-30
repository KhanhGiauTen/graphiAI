from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectDetail
from app.routers.projects import project_detail


router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{share_token}", response_model=ProjectDetail)
def get_shared_project(share_token: str, db: Session = Depends(get_db)) -> ProjectDetail:
    project = db.execute(select(Project).where(Project.share_token == share_token)).scalar_one_or_none()
    if project is None or project.visibility != "shared":
        raise HTTPException(status_code=404, detail="Shared project not found")
    return project_detail(project)
