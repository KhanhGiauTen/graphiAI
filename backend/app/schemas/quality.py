from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema


Suitability = Literal["recommended", "promising_but_review", "weak_graph_signal", "not_recommended"]
HealthStatus = Literal["pass", "warning", "fail"]


class QualityComponentScores(BaseModel):
    entity_confidence: float = Field(ge=0, le=1)
    relationship_confidence: float = Field(ge=0, le=1)
    feature_richness: float = Field(ge=0, le=1)
    task_suitability: float = Field(ge=0, le=1)
    connectivity_estimate: float = Field(ge=0, le=1)
    interpretability: float = Field(ge=0, le=1)


class HealthCheck(BaseModel):
    name: str
    status: HealthStatus
    message: str


class GraphQualityRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profile: DatasetProfile
    graph_schema: GraphSchema | None = Field(default=None, alias="schema")


class GraphQualityReport(BaseModel):
    final_score: float = Field(ge=0, le=100)
    suitability: Suitability
    component_scores: QualityComponentScores
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    leakage_warnings: list[str] = Field(default_factory=list)
    health_checks: list[HealthCheck] = Field(default_factory=list)
    explanation: str
