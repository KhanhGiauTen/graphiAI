from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="created", nullable=False)
    dataset_profile_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    graph_schemas_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_schema_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    share_token: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
