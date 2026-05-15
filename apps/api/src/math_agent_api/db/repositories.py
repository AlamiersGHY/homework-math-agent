import json
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from math_agent_api.db.models import ArtifactRecord, MessageRecord, SessionRecord, utc_now


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_session(self, session_id: str) -> SessionRecord | None:
        return self.db.get(SessionRecord, session_id)

    def list_sessions(self, limit: int = 20) -> Sequence[SessionRecord]:
        statement = select(SessionRecord).order_by(SessionRecord.updated_at.desc()).limit(limit)
        return self.db.scalars(statement).all()

    def delete_session(self, session_id: str) -> bool:
        record = self.get_session(session_id)
        if not record:
            return False
        self.db.delete(record)
        self.db.commit()
        return True

    def create_session(
        self,
        session_id: str,
        default_answer_mode: str = "guided",
        title: str | None = None,
    ) -> SessionRecord:
        record = SessionRecord(
            id=session_id,
            default_answer_mode=default_answer_mode,
            title=title,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def ensure_session(
        self,
        session_id: str,
        default_answer_mode: str = "guided",
        title: str | None = None,
    ) -> SessionRecord:
        existing = self.get_session(session_id)
        if existing:
            return existing
        return self.create_session(session_id, default_answer_mode=default_answer_mode, title=title)

    def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        answer_mode: str | None = None,
        question_type: str | None = None,
        source: str | None = None,
    ) -> MessageRecord:
        record = MessageRecord(
            session_id=session_id,
            role=role,
            content=content,
            answer_mode=answer_mode,
            question_type=question_type,
            source=source,
        )
        self.db.add(record)
        session = self.get_session(session_id)
        if session:
            session.title = session.title or _derive_title(content)
            session.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_messages(self, session_id: str, limit: int | None = None) -> Sequence[MessageRecord]:
        statement = (
            select(MessageRecord)
            .where(MessageRecord.session_id == session_id)
            .order_by(MessageRecord.created_at.asc())
        )
        if limit is not None:
            statement = statement.limit(limit)
        return self.db.scalars(statement).all()

    def list_artifacts(self, session_id: str) -> Sequence[ArtifactRecord]:
        statement = (
            select(ArtifactRecord)
            .where(ArtifactRecord.session_id == session_id)
            .order_by(ArtifactRecord.created_at.asc(), ArtifactRecord.id.asc())
        )
        return self.db.scalars(statement).all()

    def add_artifact(
        self,
        session_id: str,
        artifact_type: str,
        payload: dict,
        message_id: str | None = None,
    ) -> ArtifactRecord:
        record = ArtifactRecord(
            session_id=session_id,
            message_id=message_id,
            artifact_type=artifact_type,
            payload_json=json.dumps(payload, ensure_ascii=False),
        )
        self.db.add(record)
        session = self.get_session(session_id)
        if session:
            session.updated_at = utc_now()
        self.db.commit()
        self.db.refresh(record)
        return record


def _derive_title(content: str) -> str:
    title = " ".join(content.strip().split())
    return title[:60] or "新会话"
