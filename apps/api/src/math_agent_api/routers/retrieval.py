from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from math_agent_api.db.session import get_db_session
from math_agent_api.schemas.retrieval import RetrievalSearchRequest, RetrievalSearchResponse
from math_agent_api.services.retrieval_service import search_retrieval

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/search", response_model=RetrievalSearchResponse)
async def search(
    request: RetrievalSearchRequest,
    db: Session = Depends(get_db_session),
) -> RetrievalSearchResponse:
    return search_retrieval(db=db, query=request.query, top_k=request.top_k)
