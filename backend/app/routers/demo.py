from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.demo import DemoDataset, DemoDatasetCreateResponse
from app.services.auth import get_optional_user
from app.services.profiler import DataProfiler
from app.services.schema_recommender import RuleBasedSchemaRecommender


router = APIRouter(prefix="/demo-datasets", tags=["demo datasets"])

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
DEMO_DATASETS = {
    "fraud_transactions": DemoDataset(
        id="fraud_transactions",
        name="Fraud Transactions",
        filename="fraud_transactions.csv",
        domain="Fraud detection",
        description="User, transaction, merchant, device, amount, timestamp, and fraud label.",
        suggested_task="Transaction node classification",
        rows=10,
    ),
    "user_ratings": DemoDataset(
        id="user_ratings",
        name="User Product Ratings",
        filename="user_ratings.csv",
        domain="Recommendation",
        description="User-product interactions with ratings, review counts, and timestamps.",
        suggested_task="User-item recommendation",
        rows=5,
    ),
    "student_courses": DemoDataset(
        id="student_courses",
        name="Student Learning Analytics",
        filename="student_courses.csv",
        domain="Education analytics",
        description="Students, courses, assignments, attempt times, scores, and pass labels.",
        suggested_task="Student outcome classification",
        rows=5,
    ),
}


@router.get("", response_model=list[DemoDataset])
def list_demo_datasets() -> list[DemoDataset]:
    return list(DEMO_DATASETS.values())


@router.post("/{dataset_id}/project", response_model=DemoDatasetCreateResponse)
def create_project_from_demo(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> DemoDatasetCreateResponse:
    dataset = DEMO_DATASETS.get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Demo dataset not found")

    fixture_path = FIXTURE_DIR / dataset.filename
    if not fixture_path.exists():
        raise HTTPException(status_code=500, detail="Demo fixture is missing")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = upload_dir / f"{uuid4()}_{dataset.filename}"
    stored_path.write_bytes(fixture_path.read_bytes())

    profile = DataProfiler().profile(str(stored_path))
    schemas = RuleBasedSchemaRecommender().recommend(profile)
    project = Project(
        name=f"Demo - {dataset.name}",
        original_filename=dataset.filename,
        file_path=str(stored_path),
        file_size_bytes=stored_path.stat().st_size,
        status="schema_recommended",
        dataset_profile_json=profile.model_dump_json(),
        graph_schemas_json=json.dumps([schema.model_dump() for schema in schemas]),
        selected_schema_id=schemas[0].id if schemas else None,
        user_id=current_user.id if current_user else None,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return DemoDatasetCreateResponse(
        project_id=project.id,
        dataset=dataset,
        status=project.status,
    )
