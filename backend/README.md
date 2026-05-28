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
