from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings


connect_args = {"check_same_thread": False} if settings.database_backend == "sqlite" else {}

engine = create_engine(
    settings.sqlalchemy_database_url,
    connect_args=connect_args,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def init_db() -> None:
    from app.models import api_key, project, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_project_columns()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_sqlite_project_columns() -> None:
    if settings.database_backend != "sqlite":
        return

    columns = {
        "user_id": "VARCHAR(36)",
        "visibility": "VARCHAR(20) DEFAULT 'private'",
        "share_token": "VARCHAR(100)",
    }
    with engine.begin() as connection:
        existing = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(projects)")).fetchall()
        }
        for column_name, column_type in columns.items():
            if column_name not in existing:
                connection.execute(text(f"ALTER TABLE projects ADD COLUMN {column_name} {column_type}"))
