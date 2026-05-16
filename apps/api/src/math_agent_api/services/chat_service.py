import json
from collections.abc import AsyncIterator

from math_agent_api.db.session import SessionLocal
from math_agent_api.db.repositories import DocumentRepository
from math_agent_api.prompts.chat import build_chat_messages
from math_agent_api.providers.llm import (
    LLMProvider,
    LLMProviderError,
    MockLLMProvider,
    get_llm_provider,
)
from math_agent_api.schemas.agent_policy import AgentPolicyPlan
from math_agent_api.schemas.chat import (
    ChatStreamRequest,
    DeltaEvent,
    DoneEvent,
    MetadataEvent,
    StartEvent,
)
from math_agent_api.schemas.common import ErrorBody, QuestionType
from math_agent_api.schemas.retrieval import RetrievedSource
from math_agent_api.services.agent_policy_planner import (
    active_message_for_request,
    classify_question as _classify_question,
    create_plot_suggestion as _create_plot_suggestion,
    plan_agent_turn,
    should_visualize as _should_visualize,
)
from math_agent_api.services.retrieval_service import search_retrieval
from math_agent_api.services.session_service import (
    append_artifact,
    append_message,
    create_session_id,
    ensure_session,
)


def classify_question(message: str) -> QuestionType:
    return _classify_question(message)


def should_visualize(question_type: QuestionType, message: str | None = None) -> bool:
    return _should_visualize(question_type, message)


def create_plot_suggestion(message: str, question_type: QuestionType) -> dict | None:
    suggestion = _create_plot_suggestion(message, question_type)
    if suggestion is None:
        return None
    return suggestion.model_dump(mode="json")


def format_sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


async def stream_mock_chat(request: ChatStreamRequest) -> AsyncIterator[str]:
    session_id = request.session_id or create_session_id()
    plan = plan_agent_turn(request)

    async for event in stream_chat_with_provider(
        request=request,
        session_id=session_id,
        plan=plan,
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
    plan = plan_agent_turn(request)
    try:
        provider = get_llm_provider()
    except LLMProviderError:
        async for event in stream_chat_error(
            request=request,
            session_id=session_id,
            plan=plan,
            provider_name="unconfigured",
        ):
            yield event
        return

    async for event in stream_chat_with_provider(
        request=request,
        session_id=session_id,
        plan=plan,
        provider=provider,
        db=db,
    ):
        yield event


async def stream_chat_error(
    request: ChatStreamRequest,
    session_id: str,
    plan: AgentPolicyPlan,
    provider_name: str,
) -> AsyncIterator[str]:
    plot_suggestion = plan.plot_suggestion_payload()
    yield format_sse(
        "start",
        StartEvent(session_id=session_id, answer_mode=plan.answer_mode).model_dump(mode="json"),
    )
    yield format_sse(
        "metadata",
        MetadataEvent(
            question_type=plan.question_type,
            should_visualize=plan.needs_plot,
            plot_suggestion=plot_suggestion,
            planner=plan,
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
    provider: LLMProvider,
    db=None,
    question_type: QuestionType | None = None,
    plan: AgentPolicyPlan | None = None,
) -> AsyncIterator[str]:
    plan = plan or plan_agent_turn(request, question_type_override=question_type)
    active_message = active_message_for_request(request)
    plot_suggestion = plan.plot_suggestion_payload()
    retrieval_attempted = False
    retrieved_sources: list[RetrievedSource] = []
    has_ready_documents = False
    if db is not None:
        try:
            has_ready_documents = DocumentRepository(db).has_ready_documents()
        except Exception:
            has_ready_documents = False
    should_attempt_retrieval = plan.needs_retrieval or (
        db is not None
        and has_ready_documents
        and _should_probe_retrieval(active_message, plan.question_type)
    )
    if db is not None and should_attempt_retrieval:
        try:
            retrieval = search_retrieval(db=db, query=active_message, top_k=5)
            retrieval_attempted = True
            retrieved_sources = retrieval.results
        except Exception:
            retrieval_attempted = True
            retrieved_sources = []
    ensure_session(db, session_id, default_answer_mode=plan.answer_mode)
    user_record = append_message(
        db,
        session_id=session_id,
        role="user",
        content=active_message,
        answer_mode=plan.answer_mode,
        question_type=plan.question_type,
        source="ocr" if request.confirmed_ocr_text else "text",
    )

    yield format_sse(
        "start",
        StartEvent(
            session_id=session_id,
            answer_mode=plan.answer_mode,
            user_message_id=user_record.id if user_record else None,
        ).model_dump(mode="json"),
    )

    yield format_sse(
        "metadata",
        MetadataEvent(
            question_type=plan.question_type,
            should_visualize=plan.needs_plot,
            plot_suggestion=plot_suggestion,
            planner=plan,
            retrieval_attempted=retrieval_attempted,
            retrieved_sources=retrieved_sources,
            citations=retrieved_sources,
        ).model_dump(mode="json"),
    )

    try:
        messages = build_chat_messages(
            request,
            plan.question_type,
            answer_mode=plan.answer_mode,
            retrieved_sources=retrieved_sources,
            plot_suggestion=plot_suggestion,
            needs_clarification=plan.needs_clarification,
        )
        answer_parts: list[str] = []
        async for chunk in provider.stream_chat(messages):
            answer_parts.append(chunk)
            yield format_sse("delta", DeltaEvent(text=chunk).model_dump(mode="json"))
        assistant_record = append_message(
            db,
            session_id=session_id,
            role="assistant",
            content="".join(answer_parts),
            answer_mode=plan.answer_mode,
            question_type=plan.question_type,
            source=getattr(provider, "name", "unknown"),
        )
        if assistant_record:
            append_artifact(
                db=db,
                session_id=session_id,
                artifact_type="chat_metadata",
                payload={
                    "question_type": plan.question_type,
                    "should_visualize": plan.needs_plot,
                    "plot_suggestion": plot_suggestion,
                    "planner": plan.model_dump(mode="json"),
                    "retrieval_attempted": retrieval_attempted,
                    "retrieved_sources": [
                        source.model_dump(mode="json") for source in retrieved_sources
                    ],
                    "citations": [source.model_dump(mode="json") for source in retrieved_sources],
                },
                message_id=assistant_record.id,
            )
            if plot_suggestion:
                append_artifact(
                    db=db,
                    session_id=session_id,
                    artifact_type="plot_suggestion",
                    payload={"plot_suggestion": plot_suggestion},
                    message_id=assistant_record.id,
                )
        yield format_sse(
            "done",
            DoneEvent(
                assistant_message_id=assistant_record.id if assistant_record else None
            ).model_dump(mode="json"),
        )
    except LLMProviderError:
        async for event in stream_chat_error_tail(getattr(provider, "name", "unknown")):
            yield event


def _should_probe_retrieval(message: str, question_type: QuestionType) -> bool:
    if question_type in {QuestionType.OFF_TOPIC, QuestionType.VISUALIZATION}:
        return False
    if request_mentions_uploaded_material(message):
        return True
    topic_markers = [
        "定义",
        "定理",
        "法则",
        "概念",
        "definition",
        "theorem",
        "rule",
        "concept",
        "性质",
        "说明",
        "解释",
        "explain",
        "what is",
        "为什么",
        "是什么",
        "讲了什么",
        "核心",
        "例题",
        "复合函数",
        "链式法则",
        "求导法则",
    ]
    return any(marker in message for marker in topic_markers)


def request_mentions_uploaded_material(message: str) -> bool:
    normalized = message.lower()
    material_markers = [
        "pdf",
        "课本",
        "教材",
        "讲义",
        "材料",
        "资料",
        "课件",
        "上传",
        "附件",
        "引用",
        "来源",
        "根据",
        "你能看到",
        "看得到",
        "这份",
        "这个",
        "现在呢",
    ]
    return any(marker in message or marker in normalized for marker in material_markers)
