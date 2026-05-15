import json
from collections.abc import Sequence
from uuid import uuid4

from sqlalchemy.orm import Session

from math_agent_api.db.models import ArtifactRecord, MessageRecord, SessionRecord
from math_agent_api.db.repositories import SessionRepository
from math_agent_api.schemas.session import SessionDetail, SessionSummary, StoredArtifact, StoredMessage


def create_session_id() -> str:
    return f"session-{uuid4()}"


def ensure_session(
    db: Session | None,
    session_id: str,
    default_answer_mode: str = "guided",
    title: str | None = None,
) -> None:
    if db is None:
        return
    SessionRepository(db).ensure_session(
        session_id=session_id,
        default_answer_mode=default_answer_mode,
        title=title,
    )


def append_message(
    db: Session | None,
    session_id: str,
    role: str,
    content: str,
    answer_mode: str | None = None,
    question_type: str | None = None,
    source: str | None = None,
) -> MessageRecord | None:
    if db is None:
        return None
    repo = SessionRepository(db)
    repo.ensure_session(session_id=session_id, default_answer_mode=answer_mode or "guided")
    return repo.append_message(
        session_id=session_id,
        role=role,
        content=content,
        answer_mode=answer_mode,
        question_type=question_type,
        source=source,
    )


def list_session_summaries(db: Session, limit: int = 20) -> list[SessionSummary]:
    records = SessionRepository(db).list_sessions(limit=limit)
    return [_session_summary(record) for record in records]


def get_session_detail(db: Session, session_id: str) -> SessionDetail | None:
    repo = SessionRepository(db)
    session = repo.get_session(session_id)
    if not session:
        return None
    messages = repo.list_messages(session_id)
    return SessionDetail(
        session=_session_summary(session),
        messages=[_stored_message(message) for message in messages],
        artifacts=[_stored_artifact(artifact) for artifact in session.artifacts],
    )


def delete_session(db: Session, session_id: str) -> bool:
    return SessionRepository(db).delete_session(session_id)


def append_artifact(
    db: Session | None,
    session_id: str | None,
    artifact_type: str,
    payload: dict,
    message_id: str | None = None,
) -> ArtifactRecord | None:
    if db is None or not session_id:
        return None
    repo = SessionRepository(db)
    if not repo.get_session(session_id):
        return None
    return repo.add_artifact(
        session_id=session_id,
        artifact_type=artifact_type,
        payload=payload,
        message_id=message_id,
    )


def _session_summary(record: SessionRecord) -> SessionSummary:
    return SessionSummary(
        id=record.id,
        title=record.title,
        default_answer_mode=record.default_answer_mode,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _stored_message(record: MessageRecord) -> StoredMessage:
    role = "assistant" if record.role == "assistant" else "user"
    return StoredMessage(
        id=record.id,
        role=role,
        content=record.content,
        answer_mode=record.answer_mode,
        question_type=record.question_type,
        source=record.source,
        created_at=record.created_at,
    )


def _stored_artifact(record: ArtifactRecord) -> StoredArtifact:
    payload = json.loads(record.payload_json)
    return StoredArtifact(
        id=record.id,
        artifact_type=record.artifact_type,
        payload=payload,
        message_id=record.message_id,
        created_at=record.created_at,
    )
