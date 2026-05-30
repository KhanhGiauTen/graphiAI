import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.graph import GraphSchema
from app.services.profiler import DataProfiler
from app.services.projects import get_project_or_404, parse_profile
from app.services.schema_recommender import RuleBasedSchemaRecommender


router = APIRouter(prefix="/schema", tags=["schema"])


@router.post("/recommend/{project_id}", response_model=list[GraphSchema])
def recommend_schema(project_id: str, db: Session = Depends(get_db)) -> list[GraphSchema]:
    project = get_project_or_404(db, project_id)
    profile = parse_profile(project)
    if profile is None:
        if not project.file_path:
            raise HTTPException(status_code=400, detail="Project has no uploaded file")
        profile = DataProfiler().profile(project.file_path)
        project.dataset_profile_json = profile.model_dump_json()

    schemas = RuleBasedSchemaRecommender().recommend(profile)
    project.graph_schemas_json = json.dumps([schema.model_dump() for schema in schemas])
    project.selected_schema_id = schemas[0].id if schemas else None
    project.status = "schema_recommended"
    db.add(project)
    db.commit()
    return schemas
