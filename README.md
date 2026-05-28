# Graphify AI

> AI-assisted tabular-to-graph modeling platform for graph analytics and GNN-ready exports.

Graphify AI helps users upload tabular datasets, infer useful graph structures, inspect graph quality, visualize a sample graph, and export runnable graph construction code. The first product slice is intentionally focused on single-table event datasets with repeated entity IDs, such as fraud transactions, ratings, orders, student-course activity, and access logs.

## Product Thesis

Most business and research datasets start as tables. Before using graph analytics or GNNs, users must decide which columns are entities, which relationships are meaningful, which features are safe, and whether graph modeling is useful at all. Graphify AI acts as a practical graph modeling assistant for that conversion step.

## Lean Roadmap

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| Phase 0 | Lean scaffold | Next.js + FastAPI + SQLite/local files, health checks, shared types |
| Phase 1 | MVP core | CSV upload -> profiling -> rule schema -> graph preview -> NetworkX export |
| Phase 2 | Graph quality guardrails | Quality score, leakage checks, "should this be a graph?" warnings |
| Phase 3 | AI schema understanding | LLM column semantics, 3 schema proposals, explanation, rule fallback |
| Phase 4 | PyG export | Jupyter notebook + PyG `HeteroData` export + one baseline model |
| Phase 5 | Productization | Login, saved projects, share links, deployment |
| Phase 6 | Platform expansion | In-app experiments, teams, public API, advanced AutoML |

Phase 1 is the first demo milestone. Phase 3 is the strongest AI milestone. Phase 4 is the strongest research/portfolio milestone.

## MVP Priority

| Module | Priority | Target Phase |
|--------|----------|--------------|
| CSV upload and profiling | 5 | Phase 1 |
| Rule-based graph schema recommendation | 5 | Phase 1 |
| Graph quality score and warnings | 5 | Phase 2 |
| Demo datasets | 5 | Phase 1 |
| Graph preview | 4 | Phase 1 |
| Export NetworkX + schema files | 4 | Phase 1 |
| LLM semantic analyzer | 4 | Phase 3 |
| PyG notebook export | 3 | Phase 4 |
| In-app GNN training | 2 | Phase 6 |
| Multi-user/team/API | 1-2 | Phase 5-6 |
| Advanced AutoML | 1 | Phase 6+ |

## First Demo Story

```text
Upload transaction CSV
  -> profile columns and detect roles
  -> recommend graph schemas
  -> explain nodes, edges, features, labels
  -> preview a sampled graph
  -> export schema + nodes + edges + NetworkX builder
```

## Initial Tech Stack

```text
Frontend: Next.js 14 + TypeScript + TailwindCSS + React Flow
Backend:  FastAPI + Python 3.11 + Pandas + NetworkX + SQLAlchemy
Storage:  SQLite for metadata, local uploads/exports for MVP
AI/ML:    Rule-based first, OpenAI-compatible LLM later, PyG export later
Infra:    Local dev scripts first, Docker/deployment after MVP is stable
```

PostgreSQL, Redis, Celery, teams, public API, and in-app model training are deliberately deferred until the core workflow is useful.

## Local Phase 0 Setup

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m pytest
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run typecheck
npm run dev
```

## Demo Datasets

| File | Domain | Key Task |
|------|--------|----------|
| `fraud_transactions.csv` | Banking/FinTech | Fraud detection |
| `user_ratings.csv` | E-commerce | Recommendation/link prediction |
| `student_courses.csv` | Education | Performance prediction |

## Phase Files

- `phase0_architecture_setup.md`
- `phase1_mvp_core.md`
- `phase2_graph_quality_guardrails.md`
- `phase3_ai_schema.md`
- `phase4_pyg_export.md`
- `phase5_productization.md`
- `phase6_platform_expansion.md`

## One-Line Pitch

Graphify AI is an AI-assisted platform that converts tabular datasets into explainable graph structures, warns when graph modeling may be a poor fit, visualizes relationships, and exports graph-learning starter code.
