from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.dataset import DatasetProfile
from app.schemas.graph import GraphSchema


SemanticRole = Literal[
    "entity_id",
    "edge_feature",
    "node_feature",
    "label",
    "timestamp",
    "irrelevant",
]


class ColumnSemantic(BaseModel):
    column_name: str
    semantic_meaning: str
    entity_hint: str | None = None
    role: SemanticRole
    reasoning: str
    confidence: float = Field(ge=0, le=1)


class ColumnSemanticAnalysis(BaseModel):
    columns: list[ColumnSemantic]
    dataset_domain: str
    dataset_summary: str
    potential_tasks: list[str] = Field(default_factory=list)


class AISchemaRequest(BaseModel):
    profile: DatasetProfile


class AISchemaResponse(BaseModel):
    mode: str
    semantics: ColumnSemanticAnalysis
    schemas: list[GraphSchema]
    warnings: list[str] = Field(default_factory=list)


class SchemaExplanationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profile: DatasetProfile
    graph_schema: GraphSchema = Field(alias="schema")
    semantics: ColumnSemanticAnalysis | None = None


class SchemaExplanationResponse(BaseModel):
    explanation: str
