# Graphify AI

> AI-assisted tabular-to-graph modeling platform for graph analytics and GNN-ready exports.

Graphify AI helps users upload tabular datasets, infer useful graph structures, inspect graph quality, visualize animated graph samples, run a lightweight graph baseline, and export runnable graph construction code. The current product slice is focused on single-table event datasets with repeated entity IDs, such as fraud transactions, ratings, orders, student-course activity, and access logs.

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

The core local demo now covers the Phase 1-4 story plus a polished portfolio UI: choose a demo dataset or upload CSV, profile columns, recommend schemas, run AI-assisted schema understanding, inspect an animated graph preview, export NetworkX/PyG artifacts, run a lightweight graph baseline, and share a read-only schema report.

## Current Status

| Area | Status |
|------|--------|
| CSV upload and profiling | Implemented |
| Rule-based schema recommendation | Implemented |
| AI schema understanding | Implemented with OpenAI-compatible provider and heuristic fallback |
| Graph quality guardrails | Implemented in backend services |
| Interactive graph preview | Implemented with SVG animation, search, filters, hover tooltip, node focus, density controls, and details |
| Schema quality report | Implemented: project report API, quality panel, recommendations, JSON download |
| Export bundle | Implemented: schema, nodes, edges, labels, NetworkX, PyG helper, notebook |
| Baseline experiment runner | Implemented: degree/feature threshold baseline with fallback ranking |
| Demo readiness | Implemented: built-in demo dataset picker and project progress timeline |
| CI and Docker Compose | Implemented: backend tests, API smoke test, frontend checks, and local full-stack compose |
| Operational hardening | Implemented: request IDs, request timing, security headers, configurable rate limit, system status |
| Product accounts/sharing/API keys | Basic implementation |
| UI/UX polish | Implemented: cold/pastel dashboard, app header, demo picker, workflow actions, animated graph controls |
| Production hardening | Still pending: hosted deployment, persistent rate-limit storage, observability dashboards |

## Local Demo Screenshots

| Step | Preview |
|------|---------|
| 01. Landing app entry | ![Landing page](docs/screenshots/01_landing.png) |
| 02. Upload demo picker | ![Upload demo picker](docs/screenshots/02_upload_demo_picker.png) |
| 03. Project dashboard | ![Project dashboard](docs/screenshots/03_project_dashboard.png) |
| 04. Quality report | ![Quality report](docs/screenshots/04_quality_report.png) |
| 05. Animated graph explorer | ![Animated graph explorer](docs/screenshots/05_animated_graph.png) |
| 06. AI schema analysis | ![AI schema analysis](docs/screenshots/06_ai_schema.png) |
| 07. Baseline results | ![Baseline results](docs/screenshots/07_baseline.png) |
| 08. Export and share actions | ![Export and share actions](docs/screenshots/08_export_share.png) |
| 09. Shared read-only report | ![Shared report](docs/screenshots/09_shared_report.png) |
| 10. API docs | ![API docs](docs/screenshots/10_api_docs.png) |

See [docs/demo_walkthrough.md](docs/demo_walkthrough.md) for the full demo flow and phase/progress notes.

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
Open demo dataset or upload transaction CSV
  -> profile columns and detect roles
  -> recommend rule-based graph schemas
  -> run AI Graph Engineer for semantic schema proposals
  -> explain nodes, edges, features, labels
  -> preview a sampled graph with SVG animation and neighbor focus
  -> run a lightweight graph baseline
  -> export schema + graph tables + NetworkX/PyG starter code
  -> share a read-only graph report
```

## Initial Tech Stack

```text
Frontend: Next.js 16 + TypeScript + TailwindCSS + lucide-react
Backend:  FastAPI + Python 3.11+ + Pandas + NetworkX + SQLAlchemy
Storage:  SQLite for metadata, local uploads/exports for MVP
AI/ML:    Rule-based recommender, OpenAI-compatible LLM provider, PyG export, local graph baseline
Infra:    Local dev scripts, Docker Compose, GitHub Actions CI
```

PostgreSQL, Redis, Celery, teams, and deeper in-app model training are deliberately deferred until the core workflow is useful.

## Local Setup

Backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m pytest
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```powershell
$env:PATH = "$PWD\.tools\node-v20.12.2-win-x64;$env:PATH"
cd frontend
npm install
npm run typecheck
npm run dev -- --hostname 127.0.0.1 --port 3000
```

If you use your own Node.js installation, the `.tools` PATH step is not required.

Full stack with Docker Compose:

```powershell
docker compose up --build
```

The frontend will be available at `http://127.0.0.1:3000` and the backend at `http://127.0.0.1:8000`. Compose stores uploads, exports, and SQLite metadata in the `graphify_data` Docker volume.

If you run the frontend on another port for screenshot capture, also allow that origin on the backend:

```powershell
$env:ALLOWED_ORIGINS = "http://localhost:3010,http://127.0.0.1:3010"
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

## Optional LLM Setup

By default, AI schema analysis runs in deterministic heuristic fallback mode. To enable a hosted OpenAI-compatible model, create `backend/.env`:

```env
AI_SCHEMA_MODE=llm
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
```

Restart the backend after changing environment variables. Invalid, unavailable, or hallucinated LLM output falls back to the local heuristic path.

## Main Local URLs

| Surface | URL |
|---------|-----|
| Frontend app | `http://127.0.0.1:3000` |
| Backend health | `http://127.0.0.1:8000/health` |
| Runtime status | `http://127.0.0.1:8000/api/v1/system/status` |
| API docs | `http://127.0.0.1:8000/docs` |

## Local Verification

After starting the backend, run the smoke test:

```powershell
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```

The smoke test creates a demo fraud project, verifies schema recommendation, project report, graph preview, baseline experiment, and export generation.

Frontend verification:

```powershell
cd frontend
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

UI acceptance checks covered in the latest pass:

- Landing and Upload use the cold/pastel design system and app header.
- Demo picker creates a fraud project and opens the dashboard.
- Dashboard displays progress, selected schema, quality score, workflow actions, dataset overview, and share/export actions.
- Animated graph renders nodes and edges, supports hover tooltip, selected-node pulse, neighbor focus, density mode, node size mode, edge visibility, search, and type/relation filters.
- Shared report opens as read-only and allows JSON report download.

## Implementation Timeline

| Milestone | Result |
|-----------|--------|
| Phase 0 | Lean FastAPI + Next.js scaffold with SQLite/local file storage |
| Phase 1 | CSV upload, profiling, rule schema recommendation, graph preview, export |
| Phase 2 | Graph quality scoring and leakage/suitability guardrails |
| Phase 3 | AI schema understanding with OpenAI-compatible provider and local fallback |
| Phase 4 | PyG/notebook export and in-app baseline experiment runner |
| Phase 5/6 slice | Basic auth, saved projects, share links, API keys, and public API surface |
| Sprint 1 | Docker Compose, GitHub Actions CI, demo dataset picker, project progress timeline |
| Sprint 2 | Request IDs/timing headers, security headers, configurable in-memory rate limit |
| Sprint 3 | Project schema report, quality score dashboard, recommendations, JSON report download |
| Completion pass | Runtime status endpoint, shared report UX, API smoke test, CI smoke coverage |
| UI/UX completion pass | Cold/pastel interface, app header, polished upload/dashboard/shared pages, animated graph explorer, refreshed screenshots |

## Project Completion Estimate

| Scope | Estimate |
|-------|----------|
| Local portfolio demo | 99% |
| Practical prototype | 85% |
| Production SaaS | 45% |

The prototype is strong enough to demonstrate the product thesis locally. Production work remains around deployment, CI/CD, access control, rate limits, observability, and more serious graph ML experiment infrastructure.

## Demo Datasets

| File | Domain | Key Task |
|------|--------|----------|
| `fraud_transactions.csv` | Banking/FinTech | Fraud detection |
| `user_ratings.csv` | E-commerce | Recommendation/link prediction |
| `student_courses.csv` | Education | Performance prediction |

These datasets are also available directly from the Upload page, so a local demo can start without manually selecting a file.

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
