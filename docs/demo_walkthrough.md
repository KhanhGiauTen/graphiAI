# Graphify AI Demo Walkthrough

This walkthrough documents the current local demo path, UI/UX polish pass, screenshot capture flow, and verification checklist for Graphify AI.

## Demo Goal

Show the complete tabular-to-graph workflow:

```text
Open demo dataset or upload CSV
-> profile columns
-> generate rule-based schemas
-> run AI schema analysis
-> explain selected graph schema
-> build animated graph preview
-> run baseline experiment
-> export NetworkX/PyG starter artifacts
-> share read-only schema report
```

## Current Progress

| Area | Status | Notes |
|------|--------|-------|
| Local scaffold | Done | FastAPI, Next.js, SQLite, local uploads/exports |
| CSV profiling | Done | Detects IDs, timestamps, labels, numerical/categorical/text fields |
| Rule schema recommender | Done | Produces ranked graph schemas from column statistics |
| AI schema workflow | Done | Project-level AI Graph Engineer panel with OpenAI-compatible provider and heuristic fallback |
| Graph quality report | Done | Suitability score, component bars, health checks, leakage warnings, JSON download |
| Animated graph preview | Done | SVG edge draw, node fade/scale, selected-node pulse, hover tooltip, search, filters, density, node-size, edge visibility |
| Export bundle | Done | `schema.json`, graph tables, NetworkX builder, PyG helper, and notebook |
| Baseline runner | Done | Local degree/feature threshold classifier with fallback degree ranking |
| Product shell | Done for local prototype | Login, projects, settings, share links, shared reports, API keys, and demo dataset picker |
| UI/UX polish | Done | Cold/pastel palette, compact dashboard layout, workflow actions, consistent cards/buttons/nav |
| Operational hardening | Done for local prototype | CI, Docker Compose config, request headers, rate limit, runtime status, and smoke test |
| Production deployment | Pending | Hosting, persistent rate-limit storage, background jobs, and observability dashboards are future work |

## Screenshots

| Step | Screenshot |
|------|------------|
| Landing app entry | ![Landing page](screenshots/01_landing.png) |
| Upload demo picker | ![Upload demo picker](screenshots/02_upload_demo_picker.png) |
| Project dashboard | ![Project dashboard](screenshots/03_project_dashboard.png) |
| Quality report | ![Quality report](screenshots/04_quality_report.png) |
| Animated graph explorer | ![Animated graph explorer](screenshots/05_animated_graph.png) |
| AI schema analysis | ![AI schema](screenshots/06_ai_schema.png) |
| Baseline experiment results | ![Baseline results](screenshots/07_baseline.png) |
| Export and share actions | ![Export and share](screenshots/08_export_share.png) |
| Shared read-only report | ![Shared report](screenshots/09_shared_report.png) |
| API documentation | ![API docs](screenshots/10_api_docs.png) |

## Local Demo Steps

1. Start the backend:

```powershell
cd "C:\Users\Acer\source\repos\My Projects\GraphiAI\backend"
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

2. Start the frontend:

```powershell
cd "C:\Users\Acer\source\repos\My Projects\GraphiAI\frontend"
$env:PATH = "C:\Users\Acer\source\repos\My Projects\GraphiAI\.tools\node-v20.12.2-win-x64;$env:PATH"
npm run dev -- --hostname 127.0.0.1 --port 3000
```

3. Open the app:

```text
http://127.0.0.1:3000
```

4. Choose a demo dataset from Upload. The fastest complete story is `Fraud Transactions`.

5. On the project dashboard:

- Run AI Schema.
- Explain Schema.
- Build Animated Graph.
- Select a graph node to pin its neighborhood.
- Toggle Focus neighbors, Density, Node size, and Edge visibility.
- Run Baseline.
- Create ZIP and download the export bundle.
- Create a read-only share link and open the shared report.
- Download the schema report JSON.

## Screenshot Capture Flow

The latest screenshot pass used a separate local pair to avoid existing processes:

```powershell
$env:ALLOWED_ORIGINS = "http://localhost:3010,http://127.0.0.1:3010"
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

```powershell
cd frontend
$env:PATH = "C:\Users\Acer\source\repos\My Projects\GraphiAI\.tools\node-v20.12.2-win-x64;$env:PATH"
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8010/api/v1"
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Capture targets:

```text
/
/upload
/projects/{project_id}?demo=1
/projects/{project_id}?demo=1&capture=quality
/projects/{project_id}?demo=1&capture=graph
/projects/{project_id}?demo=1&capture=ai
/projects/{project_id}?demo=1&capture=baseline
/s/{share_token}
http://127.0.0.1:8010/docs
```

For the animated graph screenshot, the capture selected a rendered node first so the image shows the selected-node pulse state and neighbor focus panel.

## Verification Checklist

Backend:

```powershell
cd "C:\Users\Acer\source\repos\My Projects\GraphiAI"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```

Frontend:

```powershell
cd "C:\Users\Acer\source\repos\My Projects\GraphiAI\frontend"
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Browser checks:

- Landing loads and Start demo links to Upload.
- Upload demo picker renders dataset cards with badges and starts a project.
- Dashboard renders project progress, workflow actions, selected schema, quality report, AI schema, graph explorer, baseline, and export/share controls.
- Graph explorer is nonblank and interactive.
- Search, type filters, relation filters, selected node, neighbor focus, density mode, node size mode, and edge visibility work.
- Shared link opens a read-only schema report.

## Optional LLM Mode

The app defaults to deterministic heuristic fallback. To enable hosted AI schema analysis:

```env
AI_SCHEMA_MODE=llm
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
```

Restart the backend after changing environment variables.

## Current Evaluation

This project is now strong enough for a polished local portfolio demo. It is still not a full production SaaS. The next most valuable steps are:

1. Deploy a hosted demo build.
2. Replace the lightweight threshold baseline with true Node2Vec/GraphSAGE experiments.
3. Move rate limiting and job state from process memory to Redis/PostgreSQL.
4. Add observability dashboards and structured metrics.
5. Add larger benchmark datasets for report-quality validation.
