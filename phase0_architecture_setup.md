# Graphify AI — Phase 0: Lean Architecture & Setup

## Context

Graphify AI is an AI-assisted platform that helps users turn tabular datasets into graph structures. Phase 0 should create a small, runnable foundation only. The goal is not to build production infrastructure yet.

## Goal

Create a lean monorepo scaffold that can support the Phase 1 MVP:

1. FastAPI backend with health checks, settings, SQLite metadata, and local storage folders.
2. Next.js frontend with a simple app shell and API client.
3. Shared project/type contracts for dataset profiles, graph schemas, and previews.
4. Local developer workflow that runs without PostgreSQL, Redis, Celery, Nginx, or cloud services.

## Non-Goals

- No auth.
- No teams.
- No public API.
- No LLM calls.
- No PyTorch Geometric runtime dependency.
- No PostgreSQL/Redis/Celery until there is a working MVP.

## Tech Stack

### Frontend

- Next.js 14 App Router
- TypeScript
- TailwindCSS
- React Flow, added in Phase 1 when graph preview is implemented

### Backend

- FastAPI
- Pandas
- NetworkX
- Pydantic v2
- SQLAlchemy
- SQLite for MVP metadata
- Local folders for uploaded datasets and generated exports

## Target Structure

```text
graphify-ai/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── project.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   └── health.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── dataset.py
│   │   │   ├── graph.py
│   │   │   └── project.py
│   │   └── services/
│   │       └── __init__.py
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_health.py
│   ├── uploads/
│   │   └── .gitkeep
│   ├── exports/
│   │   └── .gitkeep
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Backend Tasks

1. Create `Settings` in `backend/app/config.py` with:
   - `APP_NAME`
   - `APP_VERSION`
   - `ENVIRONMENT`
   - `DATABASE_URL`, defaulting to `sqlite:///./graphify.db`
   - `UPLOAD_DIR`
   - `EXPORT_DIR`
   - `MAX_UPLOAD_SIZE_MB`
   - `ALLOWED_ORIGINS`

2. Create SQLAlchemy setup in `backend/app/database.py`:
   - sync engine for SQLite MVP
   - `SessionLocal`
   - `Base`
   - `init_db()`

3. Create a minimal `Project` model:
   - `id`
   - `name`
   - `original_filename`
   - `file_path`
   - `file_size_bytes`
   - `status`
   - `dataset_profile_json`
   - `graph_schemas_json`
   - `selected_schema_id`
   - `created_at`
   - `updated_at`

4. Create shared Pydantic schemas:
   - `ColumnProfile`
   - `DatasetProfile`
   - `NodeType`
   - `EdgeType`
   - `GraphSchema`
   - `GraphPreview`
   - `ProjectRead`
   - `ApiResponse`

5. Create `GET /health` returning:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "development"
}
```

6. Ensure app startup creates upload/export directories and initializes SQLite tables.

## Frontend Tasks

1. Create a minimal Next.js app shell.
2. Create `frontend/src/lib/api.ts` with `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000/api/v1`.
3. Create TypeScript types matching backend schema names.
4. Render a practical first page with:
   - product name
   - short product description
   - current roadmap cards
   - CTA placeholder for Phase 1 upload flow

## Acceptance Criteria

- `python -m pytest` passes in `backend`.
- `GET /health` returns status `ok`.
- Backend imports resolve.
- Frontend TypeScript types compile.
- No production-only services are required to run Phase 0.
