from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectDetail, ProjectRead
from app.services.auth import get_current_user, get_optional_user
from app.services.projects import get_project_or_404, parse_profile, parse_schemas


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectRead]:
    projects = db.execute(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc())
    ).scalars()
    return [ProjectRead.model_validate(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_access(project, current_user)
    return project_detail(project)


@router.post("/{project_id}/share", response_model=ProjectDetail)
def share_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_owner(project, current_user)
    project.visibility = "shared"
    project.share_token = project.share_token or uuid4().hex
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_detail(project)


@router.delete("/{project_id}/share", response_model=ProjectDetail)
def revoke_project_share(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_owner(project, current_user)
    project.visibility = "private"
    project.share_token = None
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_detail(project)


def project_detail(project: Project) -> ProjectDetail:
    data = ProjectRead.model_validate(project).model_dump()
    return ProjectDetail(
        **data,
        dataset_profile=parse_profile(project),
        graph_schemas=parse_schemas(project),
    )


def _ensure_project_access(project: Project, current_user: User | None) -> None:
    if project.user_id is None:
        return
    if current_user and project.user_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this project")


def _ensure_project_owner(project: Project, current_user: User) -> None:
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")
