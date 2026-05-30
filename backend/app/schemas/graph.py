from typing import Any

from pydantic import BaseModel, Field


class NodeType(BaseModel):
    name: str
    source_column: str
    feature_columns: list[str] = Field(default_factory=list)
    count_estimate: int | None = None
    reasoning: str


class EdgeType(BaseModel):
    source: str
    target: str
    relation: str
    source_columns: list[str] = Field(default_factory=list)
    directed: bool = True
    reasoning: str


class GraphSchema(BaseModel):
    id: str
    name: str
    description: str
    node_types: list[NodeType]
    edge_types: list[EdgeType]
    suggested_tasks: list[str] = Field(default_factory=list)
    quality_score: float = Field(ge=0, le=100)
    warnings: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommended_models: list[dict[str, str]] = Field(default_factory=list)


class GraphStats(BaseModel):
    num_nodes: int
    num_edges: int
    num_node_types: int
    num_edge_types: int
    avg_degree: float
    density: float
    num_connected_components: int
    top_degree_nodes: list[dict[str, Any]] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    type: str
    label: str
    features: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str
    features: dict[str, Any] = Field(default_factory=dict)


class GraphPreview(BaseModel):
    schema_id: str
    stats: GraphStats
    nodes: list[GraphNode]
    edges: list[GraphEdge]
