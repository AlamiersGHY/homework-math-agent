from __future__ import annotations

from math_agent_api.schemas.agent_policy import AgentPolicyPlan, PlotSuggestion
from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import AnswerMode, PlotType, QuestionType


def active_message_for_request(request: ChatStreamRequest) -> str:
    confirmed = (request.confirmed_ocr_text or "").strip()
    return confirmed or request.message


def plan_agent_turn(
    request: ChatStreamRequest,
    question_type_override: QuestionType | None = None,
) -> AgentPolicyPlan:
    try:
        return _plan_agent_turn(request, question_type_override=question_type_override)
    except Exception:
        return AgentPolicyPlan(
            question_type=question_type_override or QuestionType.UNKNOWN,
            answer_mode=request.answer_mode,
            input_source=_input_source(request),
            reason="Planner fallback used a conservative no-tool plan.",
        )


def _plan_agent_turn(
    request: ChatStreamRequest,
    question_type_override: QuestionType | None = None,
) -> AgentPolicyPlan:
    message = active_message_for_request(request)
    input_source = _input_source(request)
    question_type = question_type_override or classify_question(message)
    plot_suggestion = create_plot_suggestion(message, question_type)
    needs_retrieval = _needs_retrieval(message, question_type)
    needs_clarification = _needs_clarification(message, question_type)
    memory_action = _memory_action(message)
    answer_mode = _resolve_answer_mode(request.answer_mode, question_type, needs_clarification)

    return AgentPolicyPlan(
        question_type=question_type,
        needs_retrieval=needs_retrieval,
        needs_plot=plot_suggestion is not None,
        needs_clarification=needs_clarification,
        answer_mode=answer_mode,
        retrieval_scope="uploaded_course_materials" if needs_retrieval else "none",
        plot_type=plot_suggestion.plot_type if plot_suggestion else None,
        plot_suggestion=plot_suggestion,
        memory_action=memory_action,
        input_source=input_source,
        reason=_reason(
            question_type=question_type,
            needs_retrieval=needs_retrieval,
            plot_suggestion=plot_suggestion,
            needs_clarification=needs_clarification,
            input_source=input_source,
        ),
    )


def classify_question(message: str) -> QuestionType:
    normalized = message.lower().replace(" ", "")
    if _is_off_topic(message, normalized):
        return QuestionType.OFF_TOPIC
    if _is_visualization_request(message, normalized):
        return QuestionType.VISUALIZATION
    if "证明" in message or "prove" in normalized:
        return QuestionType.PROOF
    if any(token in normalized for token in ["lim", "极限", "积分", "导数", "计算", "求", "级数"]):
        return QuestionType.COMPUTATIONAL
    if any(
        token in message
        for token in ["定义", "区别", "为什么", "概念", "定理", "说明", "解释", "根据课本", "教材", "讲义", "来源"]
    ):
        return QuestionType.CONCEPTUAL
    return QuestionType.UNKNOWN


def should_visualize(question_type: QuestionType, message: str | None = None) -> bool:
    if question_type != QuestionType.VISUALIZATION:
        return False
    return True


def create_plot_suggestion(message: str, question_type: QuestionType) -> PlotSuggestion | None:
    if not should_visualize(question_type, message):
        return None

    normalized = message.replace(" ", "").lower()
    if _looks_like_region2d(message):
        return PlotSuggestion(
            plot_type=PlotType.REGION2D,
            expression=_extract_region_expression(message),
            variables=["x", "y"],
            ranges={"x": (0, 1), "y": (0, 1)},
            source="agent",
        )

    implicit_equation = _extract_implicit3d_equation(message)
    if implicit_equation is not None:
        return PlotSuggestion(
            plot_type=PlotType.IMPLICIT3D,
            expression=implicit_equation,
            variables=["x", "y", "z"],
            ranges={"x": (-1.5, 1.5), "y": (-1.5, 1.5), "z": (-1.5, 1.5)},
            source="agent",
        )

    expression = _extract_expression_after_equals(message)
    if "z=" in normalized or ("x" in normalized and "y" in normalized):
        return PlotSuggestion(
            plot_type=PlotType.SURFACE3D,
            expression=expression or "sin(x*y)",
            variables=["x", "y"],
            ranges={"x": (-3, 3), "y": (-3, 3)},
            source="agent",
        )

    return PlotSuggestion(
        plot_type=PlotType.FUNCTION2D,
        expression=expression or "sin(x)/x",
        variables=["x"],
        ranges={"x": (-6, 6)},
        source="agent",
    )


def _input_source(request: ChatStreamRequest) -> str:
    return "ocr" if (request.confirmed_ocr_text or "").strip() else "text"


def _is_off_topic(message: str, normalized: str) -> bool:
    off_topic_tokens = [
        "天气",
        "新闻",
        "股票",
        "电影",
        "游戏",
        "菜谱",
        "旅行",
        "weather",
        "stock",
        "movie",
    ]
    math_tokens = ["数学", "分析", "lim", "积分", "导数", "证明", "函数", "极限", "曲面", "区域"]
    return any(token in message or token in normalized for token in off_topic_tokens) and not any(
        token in message or token in normalized for token in math_tokens
    )


def _is_visualization_request(message: str, normalized: str) -> bool:
    return any(token in message for token in ["画", "图像", "曲面", "区域", "可视化"]) or "z=" in normalized


def _needs_retrieval(message: str, question_type: QuestionType) -> bool:
    if question_type in {QuestionType.OFF_TOPIC, QuestionType.UNKNOWN, QuestionType.VISUALIZATION}:
        return False
    source_tokens = ["课本", "教材", "讲义", "来源", "引用", "根据", "PDF", "pdf"]
    if any(token in message for token in source_tokens):
        return True
    return question_type == QuestionType.CONCEPTUAL


def _needs_clarification(message: str, question_type: QuestionType) -> bool:
    normalized = message.strip().lower()
    broad_tokens = ["不懂数学分析", "帮我学一下", "从头学", "怎么学", "学不会", "完全不懂"]
    if question_type == QuestionType.OFF_TOPIC:
        return True
    if len(normalized) < 4:
        return True
    return any(token in message for token in broad_tokens)


def _memory_action(message: str) -> str:
    if any(token in message for token in ["不懂", "不会", "卡住", "薄弱", "弱点"]):
        return "record_weak_point"
    return "none"


def _resolve_answer_mode(
    requested_mode: AnswerMode,
    question_type: QuestionType,
    needs_clarification: bool,
) -> AnswerMode:
    if needs_clarification:
        return AnswerMode.GUIDED
    return requested_mode


def _reason(
    question_type: QuestionType,
    needs_retrieval: bool,
    plot_suggestion: PlotSuggestion | None,
    needs_clarification: bool,
    input_source: str,
) -> str:
    if needs_clarification:
        return "The request is underspecified or outside the focused math learning scope."
    if plot_suggestion is not None:
        return f"The question asks for visual intuition, so a {plot_suggestion.plot_type.value} preview is useful."
    if needs_retrieval:
        return "The question asks for conceptual or source-grounded explanation, so course-material retrieval should be attempted when available."
    if input_source == "ocr":
        return "The user confirmed OCR text, so the planner uses the edited recognized problem as input."
    return f"The request is handled as a {question_type.value} math-learning turn without extra tools."


def _extract_implicit3d_equation(message: str) -> str | None:
    normalized = message.replace(" ", "").lower()
    if "=" not in normalized:
        return None
    if normalized.startswith("z="):
        return None
    if not all(variable in normalized for variable in ["x", "y", "z"]):
        return None
    left_side = normalized.split("=", 1)[0]
    if not all(variable in left_side for variable in ["x", "y", "z"]):
        return None
    compact = message.replace("＝", "=")
    start_candidates = [
        index for index in (compact.find("x"), compact.find("y"), compact.find("z")) if index >= 0
    ]
    if not start_candidates:
        return None
    equation = compact[min(start_candidates):].strip()
    for separator in ["，", ","]:
        if separator in equation:
            equation = equation.split(separator, 1)[0].strip()
    for marker in [" 的", " please", " with"]:
        if marker in equation:
            equation = equation.split(marker, 1)[0].strip()
    return equation if "=" in equation else None


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
