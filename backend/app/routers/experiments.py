from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.experiment import BaselineRunRequest, BaselineRunResponse
from app.services.experiments import BaselineRunner
from app.services.projects import get_project_or_404, select_schema


router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("/baseline/{project_id}", response_model=BaselineRunResponse)
def run_baseline(
    project_id: str,
    request: BaselineRunRequest | None = None,
    db: Session = Depends(get_db),
) -> BaselineRunResponse:
    project = get_project_or_404(db, project_id)
    if not project.file_path:
        raise HTTPException(status_code=400, detail="Project has no uploaded file")
    request = request or BaselineRunRequest()
    schema = select_schema(project, request.schema_id)
    project.selected_schema_id = schema.id
    db.add(project)
    db.commit()
    return BaselineRunner().run(
        filepath=project.file_path,
        max_rows=request.max_rows,
        positive_label=request.positive_label,
        project_id=project.id,
        schema=schema,
        test_size=request.test_size,
    )
