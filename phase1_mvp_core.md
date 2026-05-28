# Graphify AI — Phase 1: MVP Core

## Context

Phase 0 creates the lean app foundation. Phase 1 proves the core workflow:

```text
CSV upload -> dataset profiling -> rule-based graph schema -> graph preview -> NetworkX export
```

No LLM calls in this phase. The product must be useful through transparent rules and statistics first.

## Goal

Deliver a working local demo where a user can:

1. Upload a CSV file.
2. See dataset overview and column roles.
3. Receive 2-3 rule-based graph schema suggestions.
4. Preview a sampled graph.
5. Export graph files and runnable NetworkX code.

## Scope

### Backend

1. `POST /api/v1/upload`
   - Accept `.csv` only for the first implementation.
   - Validate size using `MAX_UPLOAD_SIZE_MB`.
   - Store file under `backend/uploads`.
   - Create a `Project` row.

2. `POST /api/v1/profile/{project_id}`
   - Use Pandas to compute row count, column count, missing rate, memory usage.
   - For each column, compute dtype, null count, unique count, cardinality ratio, sample values, min/max/mean where applicable.
   - Infer roles: `id`, `timestamp`, `label`, `numerical`, `categorical`, `text`, `unknown`.

3. `POST /api/v1/schema/recommend/{project_id}`
   - Generate up to 3 schemas:
     - Minimal bipartite.
     - Transaction-centered.
     - Full heterogeneous co-occurrence.
   - Do not let LLM decide anything.
   - Include plain reasoning for every node and edge.

4. `POST /api/v1/graph/build/{project_id}`
   - Build a sampled `NetworkX.MultiDiGraph`.
   - Use stable random sampling.
   - Return nodes, edges, and stats.
   - Keep graph preview capped at a sensible size.

5. `POST /api/v1/export/{project_id}`
   - Generate exactly 4 required artifacts:
     - `schema.json`
     - `graph_nodes.csv`
     - `graph_edges.csv`
     - `networkx_builder.py`
   - Optional `pyg_dataset.py` is deferred to Phase 4.

### Frontend

Create a four-tab project page:

1. Dataset Overview
2. Suggested Graph Schema
3. Graph Preview
4. Export

Use a utilitarian interface. This is a work tool, not a marketing landing page.

## Role Detection Rules

Rules should be deterministic and ordered:

| Condition | Role |
|----------|------|
| name is exactly `id` or ends with `_id`, `Id`, `ID`, `_key` | `id` |
| name contains `date`, `time`, `timestamp`, `created`, `updated` | `timestamp` |
| more than 80% non-null values parse as datetime | `timestamp` |
| name is one of `label`, `target`, `is_fraud`, `fraud`, `churn`, `class`, `y`, `passed` | `label` |
| binary numeric/bool column with label-like name | `label` |
| numeric dtype and not label/id | `numerical` |
| object/category with low cardinality | `categorical` |
| object with long average text length | `text` |
| fallback | `unknown` |

Avoid classifying arbitrary binary numeric fields as labels unless the name suggests target semantics.

## Task Suggestion Rules

- Label column with fraud-like name -> Fraud Detection.
- Any label column -> Node or edge classification candidate.
- User/item or user/product entities -> Recommendation or link prediction.
- Timestamp exists -> Temporal graph analysis warning/candidate.
- No label -> Community detection or anomaly detection.
- Fewer than 2 entity IDs -> warn that graph modeling may be weak.

## Demo Datasets

Create fixtures for:

1. `fraud_transactions.csv`
2. `user_ratings.csv`
3. `student_courses.csv`

The fraud dataset should make transaction-centered schema rank highest.

## Acceptance Criteria

- Can upload and profile `fraud_transactions.csv`.
- `user_id`, `transaction_id`, `merchant_id`, `device_id` are detected as IDs.
- `amount` is numerical.
- `timestamp` is timestamp.
- `is_fraud` is label.
- Fraud dataset returns at least 2 schema options.
- Transaction-centered fraud schema ranks highest.
- Graph preview renders at least 3 node types.
- Export ZIP includes exactly the required Phase 1 files.
- `networkx_builder.py` runs against the uploaded CSV.
- API responses for a 1000-row CSV complete within 3 seconds locally.
