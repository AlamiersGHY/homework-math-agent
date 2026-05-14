import asyncio
import json
from collections.abc import AsyncIterator
from uuid import uuid4

from math_agent_api.schemas.chat import (
    ChatStreamRequest,
    DeltaEvent,
    DoneEvent,
    MetadataEvent,
    StartEvent,
)
from math_agent_api.schemas.common import QuestionType


def format_sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def classify_question(message: str) -> QuestionType:
    normalized = message.lower()
    if any(token in message for token in ["画", "图像", "曲面", "可视化"]) or "z =" in normalized:
        return QuestionType.VISUALIZATION
    if "证明" in message:
        return QuestionType.PROOF
    if any(token in normalized for token in ["lim", "求", "积分", "导数", "计算"]):
        return QuestionType.COMPUTATIONAL
    if any(token in message for token in ["定义", "区别", "为什么", "概念"]):
        return QuestionType.CONCEPTUAL
    return QuestionType.UNKNOWN


def should_visualize(question_type: QuestionType) -> bool:
    return question_type == QuestionType.VISUALIZATION


def mock_answer_text(request: ChatStreamRequest, question_type: QuestionType) -> str:
    source = request.confirmed_ocr_text or request.message
    if request.answer_mode == "direct":
        return f"这是 mock 直接回答：已收到问题「{source}」。后续会接入真实 LLM provider。"
    if request.answer_mode == "hint":
        return f"这是 mock 提示：先判断题型为 {question_type.value}，再找最关键的下一步。"
    return f"这是 mock 分步引导：我会先确认题型为 {question_type.value}，再给出下一步提示。"


async def stream_mock_chat(request: ChatStreamRequest) -> AsyncIterator[str]:
    session_id = request.session_id or f"session-{uuid4()}"
    question_type = classify_question(request.confirmed_ocr_text or request.message)

    yield format_sse(
        "start",
        StartEvent(session_id=session_id, answer_mode=request.answer_mode).model_dump(mode="json"),
    )

    yield format_sse(
        "metadata",
        MetadataEvent(
            question_type=question_type,
            should_visualize=should_visualize(question_type),
            plot_suggestion=None,
        ).model_dump(mode="json"),
    )

    for chunk in mock_answer_text(request, question_type).split("，"):
        await asyncio.sleep(0)
        yield format_sse("delta", DeltaEvent(text=chunk).model_dump(mode="json"))

    yield format_sse("done", DoneEvent().model_dump(mode="json"))
