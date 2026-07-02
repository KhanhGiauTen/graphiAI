# Graphify AI Backend

FastAPI backend for the lean Phase 0 scaffold.

## Local Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health checks:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/health`
- `GET http://localhost:8000/api/v1/system/status`

## Deploy Notes

The backend Docker image reads the hosting platform `PORT` variable:

```bash
docker run --rm -p 8010:8010 -e PORT=8010 graphiai-api
```

For production on Render, set `ENVIRONMENT=production`, a strong `SECRET_KEY`, a non-local `ALLOWED_ORIGINS`, and Postgres `DATABASE_URL`. The root `render.yaml` wires Render Postgres and the persistent disk used by `UPLOAD_DIR` and `EXPORT_DIR`.

Smoke test:

```bash
python ../scripts/smoke_test.py --api-url http://127.0.0.1:8000/api/v1
```
