import json

from fastapi import APIRouter
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ai_schema import (
    AISchemaRequest,
    AISchemaResponse,
    SchemaExplanationRequest,
    SchemaExplanationResponse,
)
from app.services.ai.schema_understanding import AISchemaService
from app.services.projects import get_project_or_404, parse_profile


router = APIRouter(prefix="/ai/schema", tags=["ai-schema"])


@router.post("/analyze", response_model=AISchemaResponse)
async def analyze_schema(request: AISchemaRequest) -> AISchemaResponse:
    return await AISchemaService().analyze_async(request.profile)


@router.post("/analyze/{project_id}", response_model=AISchemaResponse)
async def analyze_project_schema(project_id: str, db: Session = Depends(get_db)) -> AISchemaResponse:
    project = get_project_or_404(db, project_id)
    profile = parse_profile(project)
    if profile is None:
        raise HTTPException(status_code=400, detail="Project must be profiled before AI schema analysis")

    response = await AISchemaService().analyze_async(profile)
    if response.schemas:
        project.graph_schemas_json = json.dumps([schema.model_dump() for schema in response.schemas])
        project.selected_schema_id = response.schemas[0].id
        project.status = "ai_schema_recommended" if response.mode == "llm" else "ai_schema_heuristic"
        db.add(project)
        db.commit()
    return response


@router.post("/explain", response_model=SchemaExplanationResponse)
def explain_schema(request: SchemaExplanationRequest) -> SchemaExplanationResponse:
    return AISchemaService().explain(
        profile=request.profile,
        schema=request.graph_schema,
        semantics=request.semantics,
    )
