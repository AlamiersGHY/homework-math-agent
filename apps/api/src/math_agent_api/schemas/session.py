from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class SessionSummary(BaseModel):
    id: str
    title: str | None
    default_answer_mode: str
    created_at: datetime
    updated_at: datetime


class StoredMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    answer_mode: str | None = None
    question_type: str | None = None
    source: str | None = None
    created_at: datetime


class StoredArtifact(BaseModel):
    id: str
    artifact_type: str
    payload: dict[str, Any]
    message_id: str | None = None
    created_at: datetime


class SessionDetail(BaseModel):
    session: SessionSummary
    messages: list[StoredMessage]
    artifacts: list[StoredArtifact] = []
