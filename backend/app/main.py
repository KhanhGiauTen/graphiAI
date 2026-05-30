from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import ai_schema, auth, export, graph, health, profile, projects, quality, schema, share, upload


def prepare_runtime() -> None:
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.EXPORT_DIR).mkdir(parents=True, exist_ok=True)
    init_db()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    prepare_runtime()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(health.router, prefix="/api/v1")
app.include_router(ai_schema.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(quality.router, prefix="/api/v1")
app.include_router(schema.router, prefix="/api/v1")
app.include_router(share.router, prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")
