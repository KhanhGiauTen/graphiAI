from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.dataset import DatasetProfile
from app.services.profiler import DataProfiler
from app.services.projects import get_project_or_404


router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("/{project_id}", response_model=DatasetProfile)
def profile_dataset(project_id: str, db: Session = Depends(get_db)) -> DatasetProfile:
    project = get_project_or_404(db, project_id)
    if not project.file_path:
        raise HTTPException(status_code=400, detail="Project has no uploaded file")

    profile = DataProfiler().profile(project.file_path)
    project.dataset_profile_json = profile.model_dump_json()
    project.status = "profiled"
    db.add(project)
    db.commit()
    return profile
