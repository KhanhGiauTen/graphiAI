from typing import Any, Literal

from pydantic import BaseModel, Field


ColumnRole = Literal["id", "categorical", "numerical", "timestamp", "label", "text", "unknown"]


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    null_count: int
    null_rate: float = Field(ge=0, le=1)
    unique_count: int
    cardinality_ratio: float = Field(ge=0, le=1)
    sample_values: list[Any]
    value_counts: dict[str, int] | None = None
    min_val: Any | None = None
    max_val: Any | None = None
    mean_val: float | None = None
    inferred_role: ColumnRole


class DatasetProfile(BaseModel):
    filename: str | None = None
    row_count: int
    column_count: int
    total_missing_rate: float = Field(ge=0, le=1)
    memory_usage_mb: float
    columns: list[ColumnProfile]
    id_columns: list[str] = Field(default_factory=list)
    label_columns: list[str] = Field(default_factory=list)
    has_timestamps: bool = False
