from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectDetail, ProjectRead, ProjectReport, ProjectReportOverview
from app.schemas.quality import GraphQualityReport
from app.services.auth import get_current_user, get_optional_user
from app.services.graph_quality import GraphQualityScorer
from app.services.projects import get_project_or_404, parse_profile, parse_schemas, select_schema


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectRead]:
    projects = db.execute(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc())
    ).scalars()
    return [ProjectRead.model_validate(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_access(project, current_user)
    return project_detail(project)


@router.get("/{project_id}/report", response_model=ProjectReport)
def get_project_report(
    project_id: str,
    schema_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ProjectReport:
    project = get_project_or_404(db, project_id)
    _ensure_project_access(project, current_user)
    profile = parse_profile(project)
    if profile is None:
        raise HTTPException(status_code=400, detail="Project must be profiled before generating a report")

    schema = select_schema(project, schema_id)
    quality = GraphQualityScorer().assess(profile, schema)
    return ProjectReport(
        project_id=project.id,
        project_name=project.name,
        filename=project.original_filename,
        generated_at=datetime.now(UTC),
        schema_id=schema.id,
        schema_name=schema.name,
        overview=ProjectReportOverview(
            row_count=profile.row_count,
            column_count=profile.column_count,
            missing_rate=profile.total_missing_rate,
            id_columns=profile.id_columns,
            label_columns=profile.label_columns,
            has_timestamps=profile.has_timestamps,
        ),
        node_types=[f"{node.name} from {node.source_column}" for node in schema.node_types],
        edge_types=[f"{edge.source} {edge.relation} {edge.target}" for edge in schema.edge_types],
        suggested_tasks=schema.suggested_tasks,
        quality=quality,
        recommendations=_report_recommendations(quality),
        next_steps=_report_next_steps(profile.has_timestamps, quality.leakage_warnings),
    )


@router.post("/{project_id}/share", response_model=ProjectDetail)
def share_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_owner(project, current_user)
    project.visibility = "shared"
    project.share_token = project.share_token or uuid4().hex
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_detail(project)


@router.delete("/{project_id}/share", response_model=ProjectDetail)
def revoke_project_share(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = get_project_or_404(db, project_id)
    _ensure_project_owner(project, current_user)
    project.visibility = "private"
    project.share_token = None
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_detail(project)


def project_detail(project: Project) -> ProjectDetail:
    data = ProjectRead.model_validate(project).model_dump()
    return ProjectDetail(
        **data,
        dataset_profile=parse_profile(project),
        graph_schemas=parse_schemas(project),
    )


def _ensure_project_access(project: Project, current_user: User | None) -> None:
    if project.user_id is None:
        return
    if current_user and project.user_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this project")


def _ensure_project_owner(project: Project, current_user: User) -> None:
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this project")


def _report_recommendations(quality: GraphQualityReport) -> list[str]:
    recommendations: list[str] = []
    if quality.suitability == "recommended":
        recommendations.append("Proceed with graph preview and a baseline experiment for this schema.")
    elif quality.suitability == "promising_but_review":
        recommendations.append("Review warnings, then compare this schema with at least one simpler alternative.")
    elif quality.suitability == "weak_graph_signal":
        recommendations.append("Validate that repeated entity relationships are meaningful before training GNNs.")
    else:
        recommendations.append("Prefer tabular ML unless more entity relationship columns can be added.")

    if quality.leakage_warnings:
        recommendations.append("Resolve leakage warnings before using the report for model training.")
    if any(check.status == "fail" for check in quality.health_checks):
        recommendations.append("Fix failing health checks before exporting this schema as GNN-ready data.")
    return recommendations


def _report_next_steps(has_timestamps: bool, leakage_warnings: list[str]) -> list[str]:
    next_steps = [
        "Build a sampled graph preview and inspect connected components.",
        "Run the baseline experiment to compare graph-derived signals against labels.",
        "Export the NetworkX/PyG bundle once the schema and quality warnings look acceptable.",
    ]
    if has_timestamps:
        next_steps.append("Use a time-aware train/test split for any downstream supervised experiment.")
    if leakage_warnings:
        next_steps.append("Remove or quarantine post-outcome columns before model training.")
    return next_steps
