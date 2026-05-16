import json
import re
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
from math_agent_api.services.retrieval_service import search_material_overview, search_retrieval
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


QUICK_REPLY_SYSTEM_PROMPT = """You generate follow-up suggestion chips for Math Agent.

Return exactly 3 short Chinese suggestions that the user could click as the next message.
Each suggestion must be tightly grounded in the current user question and the just-finished assistant answer.
Prefer Socratic next-step questions, checks, variants, or likely follow-up questions.
Do not use generic labels such as "继续", "给我提示", or "再讲讲".
Return only a JSON array of 3 strings, for example:
["为什么这一步成立？","能换一种方法验证吗？","如果条件改变会怎样？"]
"""


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
            quick_replies=[],
            quick_reply_source="pending",
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
    visible_user_message = _visible_message_for_persistence(request)
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
            if request_mentions_uploaded_material(active_message):
                retrieval = search_material_overview(db=db, query=active_message, top_k=5)
            else:
                retrieval = search_retrieval(db=db, query=active_message, top_k=5)
            retrieval_attempted = True
            retrieved_sources = retrieval.results
            if (
                not retrieved_sources
                and has_ready_documents
                and request_mentions_uploaded_material(active_message)
            ):
                overview = search_material_overview(db=db, query=active_message, top_k=5)
                retrieved_sources = overview.results
        except Exception:
            retrieval_attempted = True
            retrieved_sources = []
    ensure_session(db, session_id, default_answer_mode=plan.answer_mode)
    user_record = append_message(
        db,
        session_id=session_id,
        role="user",
        content=visible_user_message,
        answer_mode=plan.answer_mode,
        question_type=plan.question_type,
        source="ocr" if request.confirmed_ocr_text else "text",
    )
    if user_record and request.attachments:
        append_artifact(
            db=db,
            session_id=session_id,
            artifact_type="message_attachments",
            payload={
                "attachments": [
                    attachment.model_dump(mode="json") for attachment in request.attachments
                ]
            },
            message_id=user_record.id,
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
            quick_replies=[],
            quick_reply_source="pending",
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
        answer_text = "".join(answer_parts)
        quick_replies, quick_reply_source = await generate_quick_replies(
            provider=provider,
            plan=plan,
            user_message=active_message,
            assistant_answer=answer_text,
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
                quick_replies=quick_replies,
                quick_reply_source=quick_reply_source,
            ).model_dump(mode="json"),
        )
        assistant_record = append_message(
            db,
            session_id=session_id,
            role="assistant",
            content=answer_text,
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
                    "quick_replies": quick_replies,
                    "quick_reply_source": quick_reply_source,
                    "style_config": {
                        "style": request.context.style,
                        "soul": request.context.soul,
                    },
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


async def generate_quick_replies(
    provider: LLMProvider,
    plan: AgentPolicyPlan,
    user_message: str,
    assistant_answer: str,
) -> tuple[list[str], str]:
    if not assistant_answer.strip():
        return build_quick_replies(plan, user_message), "fallback"
    if getattr(provider, "name", "") == "mock":
        return build_quick_replies(plan, user_message), "fallback"

    prompt = (
        f"Question type: {plan.question_type.value}\n"
        f"Answer mode: {plan.answer_mode.value}\n"
        f"User question:\n{user_message[:1200]}\n\n"
        f"Assistant answer:\n{assistant_answer[:2400]}\n\n"
        "Generate exactly 3 grounded Chinese follow-up suggestions. "
        "Return only JSON, no Markdown, no prose."
    )
    try:
        chunks: list[str] = []
        async for chunk in provider.stream_chat(
            [
                {"role": "system", "content": QUICK_REPLY_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ]
        ):
            chunks.append(chunk)
        replies = parse_quick_reply_json("".join(chunks))
        if replies:
            return replies, "llm"
    except LLMProviderError:
        pass
    return build_quick_replies(plan, user_message), "fallback"


def parse_quick_reply_json(text: str) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []
    fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    payload: object | None = None
    candidates = [cleaned]
    array_match = re.search(r"\[[\s\S]*\]", cleaned)
    if array_match:
        candidates.append(array_match.group(0))
    object_match = re.search(r"\{[\s\S]*\}", cleaned)
    if object_match:
        candidates.append(object_match.group(0))
    for candidate in candidates:
        try:
            payload = json.loads(candidate)
            break
        except json.JSONDecodeError:
            continue

    if isinstance(payload, dict):
        for key in ("quick_replies", "replies", "suggestions", "followups", "follow_ups"):
            value = payload.get(key)
            if isinstance(value, list):
                payload = value
                break
    if payload is None:
        payload = _parse_quick_reply_lines(cleaned)
    if not isinstance(payload, list):
        return []
    replies: list[str] = []
    seen: set[str] = set()
    for item in payload:
        if not isinstance(item, str):
            continue
        reply = re.sub(r"\s+", " ", item).strip().strip("\"'“”")
        if not reply or reply in seen:
            continue
        if len(reply) > 48:
            reply = reply[:48].rstrip("，,；;。 ") + "？"
        replies.append(reply)
        seen.add(reply)
        if len(replies) == 3:
            break
    return replies if len(replies) == 3 else []


def _parse_quick_reply_lines(text: str) -> list[str]:
    replies: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not re.match(r"^\s*(?:[-*]|\d+[.)]|[一二三]\s*[、.])\s+", line):
            continue
        line = re.sub(r"^\s*(?:[-*]|\d+[.)]|[一二三]\s*[、.])\s+", "", line).strip()
        line = line.strip("\"'“”")
        if line:
            replies.append(line)
        if len(replies) == 3:
            break
    return replies


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


def build_quick_replies(plan: AgentPolicyPlan, message: str = "") -> list[str]:
    normalized = message.lower()
    if plan.needs_clarification:
        return ["我应该先补充哪些条件？", "能先帮我把题意拆开吗？", "如果从最简单情形看，该看什么？"]
    if plan.needs_plot:
        return ["我应该先观察图形的哪个特征？", "这个图形和题目条件怎么对应？", "下一步该把图形信息转成什么式子？"]
    if (
        "导数" in message
        or "derivative" in normalized
        or "chain rule" in normalized
        or "链式法则" in message
    ):
        return ["导数为什么等于切线斜率？", "这个几何意义和极限怎么连起来？", "能用一个具体曲线说明吗？"]
    if plan.question_type == QuestionType.PROOF:
        if "单调" in message and "有界" in message:
            return ["我应该先取哪个上确界？", "为什么单调性可以推出收敛？", "我能试着写 ε 证明吗？"]
        return ["第一步应该先构造什么对象？", "这里最关键的定理是哪一个？", "我这样补下一步是否可行？"]
    if plan.question_type == QuestionType.CONCEPTUAL:
        return ["这个概念最容易混淆的点是什么？", "能用一个反例帮我区分吗？", "我该怎样判断题目在考它？"]
    if plan.question_type == QuestionType.OCR_DERIVED:
        return ["先帮我提炼题目条件和目标。", "这道题第一步应该选什么工具？", "我写一步思路后你帮我检查。"]
    if "lim" in normalized or "极限" in message or "sin(x)/x" in normalized:
        return ["第一步为什么要想到标准极限？", "能用夹逼定理引导我吗？", "如果换成 sin(3x)/x 怎么办？"]
    if "积分" in message or "integral" in normalized:
        return ["我应该先画出积分区域吗？", "积分次序能不能交换？", "下一步变量范围怎么确定？"]
    return ["第一步应该观察哪个结构？", "我应该尝试哪种方法？", "如果我卡住了，下一问该问什么？"]


def _visible_message_for_persistence(request: ChatStreamRequest) -> str:
    message = request.message.strip()
    if message:
        return message
    if request.attachments:
        return "请根据图片内容帮我分析这道题"
    return active_message_for_request(request)


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
