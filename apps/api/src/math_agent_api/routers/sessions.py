from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from math_agent_api.db.session import get_db_session
from math_agent_api.schemas.session import SessionDetail, SessionSummary
from math_agent_api.services.session_service import (
    delete_session,
    get_session_detail,
    list_session_summaries,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionSummary])
async def list_sessions(db: Session = Depends(get_db_session)) -> list[SessionSummary]:
    return list_session_summaries(db)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str, db: Session = Depends(get_db_session)) -> SessionDetail:
    detail = get_session_detail(db, session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found")
    return detail


@router.delete("/{session_id}", status_code=204)
async def remove_session(session_id: str, db: Session = Depends(get_db_session)) -> None:
    deleted = delete_session(db, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
