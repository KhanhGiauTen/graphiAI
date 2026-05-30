from fastapi import APIRouter

from app.schemas.quality import GraphQualityReport, GraphQualityRequest
from app.services.graph_quality import GraphQualityScorer


router = APIRouter(prefix="/quality", tags=["quality"])


@router.post("/assess", response_model=GraphQualityReport)
def assess_graph_quality(request: GraphQualityRequest) -> GraphQualityReport:
    return GraphQualityScorer().assess(profile=request.profile, schema=request.graph_schema)
