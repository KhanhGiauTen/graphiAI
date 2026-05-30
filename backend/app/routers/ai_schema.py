from fastapi import APIRouter

from app.schemas.ai_schema import (
    AISchemaRequest,
    AISchemaResponse,
    SchemaExplanationRequest,
    SchemaExplanationResponse,
)
from app.services.ai.schema_understanding import AISchemaService


router = APIRouter(prefix="/ai/schema", tags=["ai-schema"])


@router.post("/analyze", response_model=AISchemaResponse)
def analyze_schema(request: AISchemaRequest) -> AISchemaResponse:
    return AISchemaService().analyze(request.profile)


@router.post("/explain", response_model=SchemaExplanationResponse)
def explain_schema(request: SchemaExplanationRequest) -> SchemaExplanationResponse:
    return AISchemaService().explain(
        profile=request.profile,
        schema=request.graph_schema,
        semantics=request.semantics,
    )
