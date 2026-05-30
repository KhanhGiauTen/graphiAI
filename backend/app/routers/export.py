from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas.project import ExportBundle
from app.services.code_generator import CodeGenerator
from app.services.projects import get_project_or_404, select_schema


class ExportRequest(BaseModel):
    schema_id: str | None = None


router = APIRouter(prefix="/export", tags=["export"])


@router.post("/{project_id}", response_model=ExportBundle)
def export_project(
    project_id: str,
    request: ExportRequest | None = None,
    db: Session = Depends(get_db),
) -> ExportBundle:
    project = get_project_or_404(db, project_id)
    if not project.file_path:
        raise HTTPException(status_code=400, detail="Project has no uploaded file")
    request = request or ExportRequest()
    schema = select_schema(project, request.schema_id)
    project.selected_schema_id = schema.id
    project.status = "exported"
    db.add(project)
    db.commit()
    return CodeGenerator().generate(project.id, project.file_path, schema)


@router.get("/{project_id}/download")
def download_export(project_id: str) -> FileResponse:
    export_dir = Path(settings.EXPORT_DIR) / project_id
    matches = list(export_dir.glob("graphify_export_*.zip"))
    if not matches:
        raise HTTPException(status_code=404, detail="Export bundle not found")
    zip_path = matches[0]
    return FileResponse(zip_path, filename=zip_path.name, media_type="application/zip")
