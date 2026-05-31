# Graphify AI Demo Walkthrough

This walkthrough captures the current local demo path for Graphify AI.

## Demo Goal

Show the complete tabular-to-graph workflow:

```text
Upload CSV
-> profile columns
-> generate rule-based schemas
-> run AI schema analysis
-> explain selected graph schema
-> build interactive graph preview
-> run baseline experiment
-> export NetworkX/PyG starter artifacts
```

## Current Progress

| Area | Status | Notes |
|------|--------|-------|
| Local scaffold | Done | FastAPI, Next.js, SQLite, local uploads/exports |
| CSV profiling | Done | Detects IDs, timestamps, labels, numerical/categorical/text fields |
| Rule schema recommender | Done | Produces ranked graph schemas from column statistics |
| AI schema workflow | Done | Project-level AI Graph Engineer panel with OpenAI-compatible provider and heuristic fallback |
| Interactive graph preview | Done | SVG graph with type filters, relation filters, search, selected node details, and neighbor focus |
| Export bundle | Done | `schema.json`, graph tables, NetworkX builder, PyG helper, and notebook |
| Baseline runner | Done | Local degree/feature threshold classifier with fallback degree ranking |
| Product shell | Done for local prototype | Login, projects, share links, shared reports, API keys, and demo dataset picker |
| Operational hardening | Done for local prototype | CI, Docker Compose config, request headers, rate limit, runtime status, and smoke test |
| Production deployment | Pending | Hosting, persistent rate-limit storage, and observability dashboards are future work |

## Screenshots

| Step | Screenshot |
|------|------------|
| Landing page | ![Landing page](screenshots/01_landing.png) |
| Upload page | ![Upload page](screenshots/02_upload.png) |
| Project overview and AI schema | ![Project AI schema](screenshots/03_project_ai_schema.png) |
| Interactive graph explorer | ![Graph explorer](screenshots/04_graph_explorer.png) |
| Baseline experiment results | ![Baseline results](screenshots/05_baseline_results.png) |
| API documentation | ![API docs](screenshots/06_api_docs.png) |

The section screenshots are generated through local demo URLs:

```text
/projects/{project_id}?demo=1&capture=ai
/projects/{project_id}?demo=1&capture=graph
/projects/{project_id}?demo=1&capture=baseline
```

These query parameters are intended for local documentation capture. Normal project usage does not require them.

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

4. Upload one of the demo CSV fixtures:

```text
backend/tests/fixtures/fraud_transactions.csv
backend/tests/fixtures/user_ratings.csv
backend/tests/fixtures/student_courses.csv
```

5. On the project page:

- Run AI Schema.
- Explain Schema.
- Build Preview.
- Run Baseline.
- Create ZIP and download the export bundle.
- Review the quality panel and download the schema report JSON.

6. Run the API smoke test:

```powershell
cd "C:\Users\Acer\source\repos\My Projects\GraphiAI"
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```

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

This project is now strong enough for a local portfolio demo. It is not yet a production SaaS. The next most valuable steps are:

1. Deploy a hosted demo build.
2. Replace the lightweight threshold baseline with true Node2Vec/GraphSAGE experiments.
3. Move rate limiting and job state from process memory to Redis/PostgreSQL.
4. Add observability dashboards and structured metrics.
5. Add larger benchmark datasets for report-quality validation.
