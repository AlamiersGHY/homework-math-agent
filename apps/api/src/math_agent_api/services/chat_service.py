import json
from collections.abc import AsyncIterator

from math_agent_api.db.session import SessionLocal
from math_agent_api.prompts.chat import build_chat_messages
from math_agent_api.providers.llm import (
    LLMProvider,
    LLMProviderError,
    MockLLMProvider,
    get_llm_provider,
)
from math_agent_api.schemas.chat import (
    ChatStreamRequest,
    DeltaEvent,
    DoneEvent,
    MetadataEvent,
    StartEvent,
)
from math_agent_api.schemas.common import ErrorBody, QuestionType
from math_agent_api.services.session_service import append_message, create_session_id, ensure_session


def format_sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def classify_question(message: str) -> QuestionType:
    normalized = message.lower()
    if any(token in message for token in ["画", "图像", "曲面", "区域", "可视化"]) or "z =" in normalized:
        return QuestionType.VISUALIZATION
    if "证明" in message:
        return QuestionType.PROOF
    if any(token in normalized for token in ["lim", "求", "积分", "导数", "计算"]):
        return QuestionType.COMPUTATIONAL
    if any(token in message for token in ["定义", "区别", "为什么", "概念"]):
        return QuestionType.CONCEPTUAL
    return QuestionType.UNKNOWN


def should_visualize(question_type: QuestionType, message: str | None = None) -> bool:
    if question_type != QuestionType.VISUALIZATION:
        return False
    if message and _is_complex_implicit_surface(message):
        return False
    return True


def create_plot_suggestion(message: str, question_type: QuestionType) -> dict | None:
    if not should_visualize(question_type, message):
        return None

    normalized = message.replace(" ", "").lower()
    if _looks_like_region2d(message):
        return {
            "plot_type": "region2d",
            "expression": _extract_region_expression(message),
            "variables": ["x", "y"],
            "ranges": {"x": [0, 1], "y": [0, 1]},
            "source": "agent",
        }

    expression = _extract_expression_after_equals(message)
    if "z=" in normalized or ("x" in normalized and "y" in normalized):
        return {
            "plot_type": "surface3d",
            "expression": expression or "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
            "source": "agent",
        }

    return {
        "plot_type": "function2d",
        "expression": expression or "sin(x)/x",
        "variables": ["x"],
        "ranges": {"x": [-6, 6]},
        "source": "agent",
    }


def _is_complex_implicit_surface(message: str) -> bool:
    normalized = message.replace(" ", "").lower()
    if "=" not in normalized:
        return False
    left_side = normalized.split("=", 1)[0]
    return "x" in left_side and "y" in left_side and "z" in left_side


def _looks_like_region2d(message: str) -> bool:
    normalized = message.replace(" ", "").lower()
    mentions_region = "区域" in message or "region" in normalized
    return mentions_region and "x" in normalized and "y" in normalized and "<=" in normalized


def _extract_region_expression(message: str) -> str:
    for marker in ["D:", "d:", "D：", "d："]:
        if marker in message:
            return message.split(marker, 1)[1].replace("，", ",").strip()
    return "0<=x<=1, 0<=y<=x"


def _extract_expression_after_equals(message: str) -> str | None:
    for marker in ["z =", "z=", "f(x)=", "y = ", "y="]:
        if marker in message:
            candidate = message.split(marker, 1)[1]
            candidate = candidate.replace("的三维曲面", "").replace("的图像", "")
            candidate = candidate.replace("三维曲面", "").replace("图像", "")
            candidate = candidate.replace("，", " ").replace(",", " ").strip()
            return candidate.split()[0] if candidate else None
    return None


async def stream_mock_chat(request: ChatStreamRequest) -> AsyncIterator[str]:
    session_id = request.session_id or create_session_id()
    question_type = classify_question(request.confirmed_ocr_text or request.message)

    async for event in stream_chat_with_provider(
        request=request,
        session_id=session_id,
        question_type=question_type,
        provider=MockLLMProvider(),
    ):
        yield event


async def stream_chat(request: ChatStreamRequest, db=None) -> AsyncIterator[str]:
    if db is not None:
        async for event in _stream_chat(request, db):
            yield event
        return

    with SessionLocal() as created_db:
        async for event in _stream_chat(request, created_db):
            yield event


async def _stream_chat(request: ChatStreamRequest, db=None) -> AsyncIterator[str]:
    session_id = request.session_id or create_session_id()
    question_type = classify_question(request.confirmed_ocr_text or request.message)
    try:
        provider = get_llm_provider()
    except LLMProviderError:
        async for event in stream_chat_error(
            request=request,
            session_id=session_id,
            question_type=question_type,
            provider_name="unconfigured",
        ):
            yield event
        return

    async for event in stream_chat_with_provider(
        request=request,
        session_id=session_id,
        question_type=question_type,
        provider=provider,
        db=db,
    ):
        yield event


async def stream_chat_error(
    request: ChatStreamRequest,
    session_id: str,
    question_type: QuestionType,
    provider_name: str,
) -> AsyncIterator[str]:
    active_message = request.confirmed_ocr_text or request.message
    plot_suggestion = create_plot_suggestion(active_message, question_type)
    yield format_sse(
        "start",
        StartEvent(session_id=session_id, answer_mode=request.answer_mode).model_dump(mode="json"),
    )
    yield format_sse(
        "metadata",
        MetadataEvent(
            question_type=question_type,
            should_visualize=plot_suggestion is not None,
            plot_suggestion=plot_suggestion,
        ).model_dump(mode="json"),
    )
    async for event in stream_chat_error_tail(provider_name):
        yield event


async def stream_chat_error_tail(provider_name: str) -> AsyncIterator[str]:
    yield format_sse(
        "error",
        ErrorBody(
            code="llm_provider_error",
            message="LLM provider failed. Check backend provider configuration or API availability.",
            details={"provider": provider_name},
        ).model_dump(mode="json"),
    )
    yield format_sse("done", DoneEvent(finish_reason="error").model_dump(mode="json"))


async def stream_chat_with_provider(
    request: ChatStreamRequest,
    session_id: str,
    question_type: QuestionType,
    provider: LLMProvider,
    db=None,
) -> AsyncIterator[str]:
    active_message = request.confirmed_ocr_text or request.message
    plot_suggestion = create_plot_suggestion(active_message, question_type)
    ensure_session(db, session_id, default_answer_mode=request.answer_mode)
    append_message(
        db,
        session_id=session_id,
        role="user",
        content=active_message,
        answer_mode=request.answer_mode,
        question_type=question_type,
        source="ocr" if request.confirmed_ocr_text else "text",
    )

    yield format_sse(
        "start",
        StartEvent(session_id=session_id, answer_mode=request.answer_mode).model_dump(mode="json"),
    )

    yield format_sse(
        "metadata",
        MetadataEvent(
            question_type=question_type,
            should_visualize=plot_suggestion is not None,
            plot_suggestion=plot_suggestion,
        ).model_dump(mode="json"),
    )

    try:
        messages = build_chat_messages(request, question_type)
        answer_parts: list[str] = []
        async for chunk in provider.stream_chat(messages):
            answer_parts.append(chunk)
            yield format_sse("delta", DeltaEvent(text=chunk).model_dump(mode="json"))
        append_message(
            db,
            session_id=session_id,
            role="assistant",
            content="".join(answer_parts),
            answer_mode=request.answer_mode,
            question_type=question_type,
            source=getattr(provider, "name", "unknown"),
        )
        yield format_sse("done", DoneEvent().model_dump(mode="json"))
    except LLMProviderError:
        async for event in stream_chat_error_tail(getattr(provider, "name", "unknown")):
            yield event
