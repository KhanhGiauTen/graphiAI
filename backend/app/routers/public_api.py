from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.models.api_key import ApiKey
from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema
from app.schemas.quality import GraphQualityReport, GraphQualityRequest
from app.services.api_keys import get_api_key_record
from app.services.graph_quality import GraphQualityScorer
from app.services.profiler import DataProfiler
from app.services.schema_recommender import RuleBasedSchemaRecommender


router = APIRouter(prefix="/public/v1", tags=["public-api"])


@router.post("/profile", response_model=DatasetProfile)
async def public_profile(
    file: UploadFile = File(...),
    _: ApiKey = Depends(get_api_key_record),
) -> DatasetProfile:
    original_filename = file.filename or "dataset.csv"
    if Path(original_filename).suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Only .csv files are supported")
    content = await file.read()
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    path = upload_dir / f"public_{uuid4()}_{Path(original_filename).name}"
    path.write_bytes(content)
    return DataProfiler().profile(str(path))


@router.post("/schema/recommend", response_model=list[GraphSchema])
def public_schema_recommend(
    profile: DatasetProfile,
    _: ApiKey = Depends(get_api_key_record),
) -> list[GraphSchema]:
    return RuleBasedSchemaRecommender().recommend(profile)


@router.post("/quality/assess", response_model=GraphQualityReport)
def public_quality_assess(
    request: GraphQualityRequest,
    _: ApiKey = Depends(get_api_key_record),
) -> GraphQualityReport:
    return GraphQualityScorer().assess(request.profile, request.graph_schema)
