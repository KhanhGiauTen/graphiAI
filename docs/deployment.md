# Graphify AI Deployment Guide

This guide deploys the current prototype as:

```text
Vercel frontend -> Render FastAPI backend -> Render Postgres + Render disk
```

## 1. Render Backend

1. In Render, create a Blueprint from this repository.
2. Use the root-level `render.yaml`.
3. During Blueprint creation, provide `ALLOWED_ORIGINS`.
   - After Vercel is created, set this to the exact frontend origin, for example `https://graphiai.vercel.app`.
   - Do not use `*` or localhost in production.
4. Render creates:
   - `graphiai-api` Docker web service.
   - `graphiai-db` Postgres database.
   - `graphiai-data` persistent disk at `/var/data`.
5. Optional LLM mode:
   - Keep `AI_SCHEMA_MODE=heuristic` for the public demo.
   - To enable hosted LLM later, add `OPENAI_API_KEY`, set `AI_SCHEMA_MODE=llm`, and set `LLM_MODEL`.

Expected backend URL:

```text
https://graphiai-api.onrender.com
```

Expected API URL:

```text
https://graphiai-api.onrender.com/api/v1
```

Health checks:

```powershell
Invoke-WebRequest https://graphiai-api.onrender.com/health
Invoke-WebRequest https://graphiai-api.onrender.com/api/v1/system/status
```

## 2. Vercel Frontend

1. Create a Vercel project from the same GitHub repository.
2. Set the project root directory to:

```text
frontend
```

3. Set Vercel environment variables for Production and Preview:

```text
NEXT_PUBLIC_API_URL=https://graphiai-api.onrender.com/api/v1
```

4. Build settings are defined in `frontend/vercel.json`:

```text
Install Command: npm ci
Build Command: npm run build
Framework: Next.js
```

## 3. GitHub Secrets for CI/CD

Add these repository secrets in GitHub:

| Secret | Value |
|--------|-------|
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL for `graphiai-api` |
| `VERCEL_TOKEN` | Vercel access token |
| `VERCEL_ORG_ID` | Vercel team/user ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `PROD_API_URL` | `https://graphiai-api.onrender.com/api/v1` |
| `PROD_FRONTEND_URL` | Vercel production URL, for example `https://graphiai.vercel.app` |

The deploy workflow runs only after the `CI` workflow succeeds on `main`, or manually through `workflow_dispatch`.

## 4. Local Pre-Deploy Checks

Backend:

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

Start local API and smoke test:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```

Frontend:

```powershell
cd frontend
npm ci
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## 5. Docker Deploy Simulation

Build backend:

```powershell
docker build -t graphiai-api ./backend
```

Run production-like container:

```powershell
docker run --rm `
  -p 8010:8010 `
  -e PORT=8010 `
  -e ENVIRONMENT=production `
  -e SECRET_KEY=local-production-test-secret `
  -e DATABASE_URL=sqlite:////var/data/graphify.db `
  -e UPLOAD_DIR=/var/data/uploads `
  -e EXPORT_DIR=/var/data/exports `
  -e ALLOWED_ORIGINS=https://graphiai.vercel.app `
  -e RATE_LIMIT_ENABLED=true `
  -v ${PWD}\.tmp\graphiai-data:/var/data `
  graphiai-api
```

Verify:

```powershell
Invoke-WebRequest http://127.0.0.1:8010/health
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url http://127.0.0.1:8010/api/v1
```

## 6. Post-Deploy Backtest

Run after Render and Vercel are live:

```powershell
.\.venv\Scripts\python.exe .\scripts\smoke_test.py --api-url https://graphiai-api.onrender.com/api/v1
```

Manual UI checks:

- Open Vercel production URL.
- Start `Fraud Transactions` demo.
- Confirm project dashboard loads.
- Build Animated Graph.
- Run Baseline.
- Create Export.
- Create Share link.
- Open shared read-only report.

## 7. Railway Fallback

Railway can run the same backend image. Set:

```text
PORT=<Railway-provided value>
DATABASE_URL=<Railway Postgres URL>
UPLOAD_DIR=/var/data/uploads
EXPORT_DIR=/var/data/exports
ALLOWED_ORIGINS=<Vercel production URL>
SECRET_KEY=<strong random value>
```

The backend Dockerfile reads `$PORT`, so it is compatible with Railway health checks.
