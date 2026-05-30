from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.project import Project
from app.schemas.project import UploadResponse


router = APIRouter(tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)) -> UploadResponse:
    original_filename = file.filename or "dataset.csv"
    if Path(original_filename).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Only .csv files are supported in Phase 1")

    content = await file.read()
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(original_filename).name
    stored_path = upload_dir / f"{uuid4()}_{safe_name}"
    stored_path.write_bytes(content)

    project = Project(
        name=Path(safe_name).stem,
        original_filename=safe_name,
        file_path=str(stored_path),
        file_size_bytes=len(content),
        status="uploaded",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return UploadResponse(
        project_id=project.id,
        filename=safe_name,
        size_bytes=len(content),
        status=project.status,
    )
