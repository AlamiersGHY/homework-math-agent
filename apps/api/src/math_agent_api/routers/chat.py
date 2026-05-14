from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.services.chat_service import stream_mock_chat

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(request: ChatStreamRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_mock_chat(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
