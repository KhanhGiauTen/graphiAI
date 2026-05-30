from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


BaselineMode = Literal[
    "supervised_classification",
    "unsupervised_degree_ranking",
    "not_runnable",
]


class BaselineRunRequest(BaseModel):
    schema_id: str | None = None
    test_size: float = Field(default=0.3, ge=0.1, le=0.5)
    max_rows: int = Field(default=5000, ge=10, le=50000)
    positive_label: str | None = None


class BaselineMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float
    support: int
    positive_label: str


class BaselineRule(BaseModel):
    feature: str
    threshold: float
    direction: Literal["gte", "lte"]
    negative_label: str
    train_f1: float
    train_accuracy: float


class BaselinePrediction(BaseModel):
    node_id: str
    node_type: str
    score: float
    predicted_label: str | None = None
    true_label: str | None = None
    features: dict[str, float] = Field(default_factory=dict)


class BaselineRunResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    project_id: str
    schema_id: str
    mode: BaselineMode
    model_name: str
    target: dict[str, str | None] = Field(default_factory=dict)
    metrics: BaselineMetrics | None = None
    rule: BaselineRule | None = None
    label_distribution: dict[str, int] = Field(default_factory=dict)
    top_predictions: list[BaselinePrediction] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    summary: str
