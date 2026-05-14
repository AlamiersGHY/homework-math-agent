from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from math_agent_api.db.session import Base


def create_id(prefix: str) -> str:
    return f"{prefix}-{uuid4()}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    default_answer_mode: Mapped[str] = mapped_column(String(20), default="guided")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    messages: Mapped[list["MessageRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["ArtifactRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class MessageRecord(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(80), primary_key=True, default=lambda: create_id("msg"))
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    answer_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    question_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    session: Mapped[SessionRecord] = relationship(back_populates="messages")
    artifacts: Mapped[list["ArtifactRecord"]] = relationship(back_populates="message")


class ArtifactRecord(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(
        String(80), primary_key=True, default=lambda: create_id("artifact")
    )
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"), nullable=True)
    artifact_type: Mapped[str] = mapped_column(String(30))
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    session: Mapped[SessionRecord] = relationship(back_populates="artifacts")
    message: Mapped[MessageRecord | None] = relationship(back_populates="artifacts")
