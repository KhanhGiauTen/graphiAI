from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from pandas.api import types as pd_types

from app.schemas.dataset import ColumnProfile, DatasetProfile


LABEL_NAMES = {"label", "target", "is_fraud", "fraud", "churn", "class", "y", "passed"}
TIMESTAMP_TOKENS = ("date", "time", "timestamp", "created", "updated")


class DataProfiler:
    def profile(self, filepath: str) -> DatasetProfile:
        df = pd.read_csv(filepath)
        row_count = len(df)
        columns = [self._profile_column(df[column_name], row_count) for column_name in df.columns]
        total_cells = max(row_count * max(len(df.columns), 1), 1)
        total_missing = int(df.isna().sum().sum())

        return DatasetProfile(
            filename=Path(filepath).name,
            row_count=row_count,
            column_count=len(df.columns),
            total_missing_rate=total_missing / total_cells,
            memory_usage_mb=float(df.memory_usage(deep=True).sum()) / (1024 * 1024),
            columns=columns,
            id_columns=[column.name for column in columns if column.inferred_role == "id"],
            label_columns=[column.name for column in columns if column.inferred_role == "label"],
            has_timestamps=any(column.inferred_role == "timestamp" for column in columns),
        )

    def _profile_column(self, series: pd.Series, row_count: int) -> ColumnProfile:
        non_null = series.dropna()
        unique_count = int(non_null.nunique(dropna=True))
        cardinality_ratio = unique_count / max(row_count, 1)
        dtype = str(series.dtype)
        role = self._infer_role(series, unique_count, cardinality_ratio)
        min_val, max_val, mean_val = self._numeric_stats(series)
        value_counts = self._value_counts(series, role, unique_count)

        return ColumnProfile(
            name=str(series.name),
            dtype=dtype,
            null_count=int(series.isna().sum()),
            null_rate=float(series.isna().sum() / max(row_count, 1)),
            unique_count=unique_count,
            cardinality_ratio=float(cardinality_ratio),
            sample_values=[_json_safe(value) for value in non_null.head(5).tolist()],
            value_counts=value_counts,
            min_val=_json_safe(min_val),
            max_val=_json_safe(max_val),
            mean_val=mean_val,
            inferred_role=role,
        )

    def _infer_role(self, series: pd.Series, unique_count: int, cardinality_ratio: float) -> str:
        name = str(series.name)
        normalized = name.lower()

        if normalized == "id" or name.endswith(("_id", "_key")) or name.endswith(("Id", "ID")):
            return "id"
        if any(token in normalized for token in TIMESTAMP_TOKENS):
            return "timestamp"
        if normalized in LABEL_NAMES:
            return "label"
        if self._is_label_like_binary(series, normalized, unique_count):
            return "label"
        if (pd_types.is_object_dtype(series) or isinstance(series.dtype, pd.CategoricalDtype)) and self._datetime_parse_rate(series) > 0.80:
            return "timestamp"
        if pd_types.is_numeric_dtype(series):
            return "numerical"
        if pd_types.is_bool_dtype(series):
            return "categorical"
        if pd_types.is_object_dtype(series) or pd_types.is_categorical_dtype(series):
            if self._avg_text_length(series) > 30:
                return "text"
            if unique_count <= 50 or cardinality_ratio <= 0.20:
                return "categorical"
        return "unknown"

    def _datetime_parse_rate(self, series: pd.Series) -> float:
        non_null = series.dropna()
        if len(non_null) == 0:
            return 0.0
        sample = non_null.head(200)
        parsed = pd.to_datetime(sample, errors="coerce", utc=False)
        return float(parsed.notna().sum() / len(sample))

    def _is_label_like_binary(self, series: pd.Series, normalized: str, unique_count: int) -> bool:
        if unique_count != 2:
            return False
        if not (pd_types.is_numeric_dtype(series) or pd_types.is_bool_dtype(series)):
            return False
        return any(token in normalized for token in ["is_", "has_", "label", "target", "fraud", "churn", "class", "passed"])

    def _avg_text_length(self, series: pd.Series) -> float:
        non_null = series.dropna().astype(str)
        if len(non_null) == 0:
            return 0.0
        return float(non_null.head(200).str.len().mean())

    def _numeric_stats(self, series: pd.Series) -> tuple[Any | None, Any | None, float | None]:
        if not pd_types.is_numeric_dtype(series):
            return None, None, None
        non_null = series.dropna()
        if len(non_null) == 0:
            return None, None, None
        return non_null.min(), non_null.max(), float(non_null.mean())

    def _value_counts(self, series: pd.Series, role: str, unique_count: int) -> dict[str, int] | None:
        if role != "label" and unique_count > 20:
            return None
        counts = series.dropna().value_counts().head(20)
        return {str(_json_safe(index)): int(value) for index, value in counts.items()}


def _json_safe(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
