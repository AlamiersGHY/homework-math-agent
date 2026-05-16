from __future__ import annotations

import re

from math_agent_api.schemas.agent_policy import AgentPolicyPlan, PlotSuggestion
from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import AnswerMode, PlotType, QuestionType
from math_agent_api.schemas.plots import PlotPreviewRequest
from math_agent_api.services.plot_service import PlotValidationError, validate_plot_request


VISUALIZATION_TOKENS = [
    "画",
    "图像",
    "图形",
    "曲面",
    "区域",
    "可视化",
    "三维",
    "空间",
    "立体",
    "几何",
    "想象不出来",
    "看不出来",
    "几何直观",
    "空间感",
    "鐢?",
    "鍥惧儚",
    "鍥惧舰",
    "鏇查潰",
    "鍖哄煙",
    "鍙鍖?",
    "涓夌淮",
    "绌洪棿",
]
SPACE_TOKENS = ["三维", "空间", "立体", "曲面", "几何曲面", "3d", "surface", "涓夌淮", "绌洪棿", "鏇查潰"]
SOURCE_TOKENS = ["课本", "教材", "讲义", "来源", "引用", "根据", "PDF", "pdf", "璇炬湰", "鏁欐潗", "璁蹭箟", "鏉ユ簮", "寮曠敤", "鏍规嵁"]
MATERIAL_REFERENCE_TOKENS = [
    "课本",
    "教材",
    "讲义",
    "材料",
    "资料",
    "pdf",
    "PDF",
    "上传",
    "附件",
    "引用",
    "来源",
    "根据",
    "这份",
    "这个",
    "现在",
    "课件",
]
COURSE_TOPIC_TOKENS = [
    "定义",
    "定理",
    "法则",
    "概念",
    "性质",
    "说明",
    "解释",
    "为什么",
    "是什么",
    "讲了什么",
    "核心",
    "复合函数",
    "链式法则",
    "求导法则",
]


def active_message_for_request(request: ChatStreamRequest) -> str:
    confirmed = (request.confirmed_ocr_text or "").strip()
    return confirmed or request.message


def contextual_message_for_request(request: ChatStreamRequest) -> str:
    active = active_message_for_request(request)
    context_parts: list[str] = []
    for turn in request.context.previous_turns[-4:]:
        content = turn.get("content")
        if isinstance(content, str) and content.strip():
            context_parts.append(content.strip())
    if not context_parts:
        return active
    return "\n".join([*context_parts, active])


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
    planning_text = contextual_message_for_request(request)
    input_source = _input_source(request)
    question_type = question_type_override or classify_question(planning_text)
    plot_suggestion = create_plot_suggestion(message, question_type)
    if plot_suggestion is None and message.strip() != planning_text.strip():
        plot_suggestion = create_plot_suggestion(planning_text, question_type)
    needs_retrieval = _needs_retrieval(message, question_type)
    needs_clarification = _needs_clarification(
        message=message,
        planning_text=planning_text,
        question_type=question_type,
        plot_suggestion=plot_suggestion,
    )
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
    normalized = _compact(message)
    if _is_off_topic(message, normalized):
        return QuestionType.OFF_TOPIC
    if _is_visualization_request(message, normalized):
        return QuestionType.VISUALIZATION
    if "证明" in message or "璇佹槑" in message or "prove" in normalized:
        return QuestionType.PROOF
    if any(token in normalized for token in ["lim", "极限", "积分", "导数", "计算", "求", "级数", "鏋侀檺", "绉垎", "瀵兼暟", "璁＄畻", "姹?", "绾ф暟"]):
        return QuestionType.COMPUTATIONAL
    if any(
        token in message
        for token in [
            "定义",
            "区别",
            "为什么",
            "概念",
            "定理",
            "说明",
            "解释",
            "根据课本",
            "教材",
            "讲义",
            "来源",
            "瀹氫箟",
            "鍖哄埆",
            "涓轰粈涔?",
            "姒傚康",
            "瀹氱悊",
            "璇存槑",
            "瑙ｉ噴",
            "鏍规嵁璇炬湰",
            "鏁欐潗",
            "璁蹭箟",
            "鏉ユ簮",
        ]
    ):
        return QuestionType.CONCEPTUAL
    return QuestionType.UNKNOWN


def should_visualize(question_type: QuestionType, message: str | None = None) -> bool:
    return question_type == QuestionType.VISUALIZATION


def create_plot_suggestion(message: str, question_type: QuestionType) -> PlotSuggestion | None:
    if not should_visualize(question_type, message):
        return None

    normalized = _compact(message)
    expression = _extract_expression_after_equals(message)
    if expression and _looks_like_upper_hemisphere(message, normalized):
        return _valid_plot_suggestion(
            PlotSuggestion(
                plot_type=PlotType.SURFACE3D,
                expression=expression,
                variables=["x", "y"],
                ranges={"x": (-1, 1), "y": (-1, 1)},
                source="agent",
            )
        )

    if _looks_like_upper_hemisphere(message, normalized):
        return PlotSuggestion(
            plot_type=PlotType.SURFACE3D,
            expression="sqrt(a^2 - x^2 - y^2)",
            variables=["x", "y"],
            ranges={"x": (-1, 1), "y": (-1, 1)},
            source="agent",
        )

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
        return _valid_plot_suggestion(
            PlotSuggestion(
                plot_type=PlotType.IMPLICIT3D,
                expression=implicit_equation,
                variables=["x", "y", "z"],
                ranges={"x": (-1.5, 1.5), "y": (-1.5, 1.5), "z": (-1.5, 1.5)},
                source="agent",
            )
        )

    if _looks_like_function2d(message, normalized):
        return _valid_plot_suggestion(
            PlotSuggestion(
                plot_type=PlotType.FUNCTION2D,
                expression=expression or "sin(x)/x",
                variables=["x"],
                ranges={"x": (-6, 6)},
                source="agent",
            )
        )

    if expression and _looks_like_space_request(message, normalized):
        ranges = {"x": (-3, 3), "y": (-3, 3)}
        if "sqrt" in expression.lower() and "1" in expression:
            ranges = {"x": (-1, 1), "y": (-1, 1)}
        return _valid_plot_suggestion(
            PlotSuggestion(
                plot_type=PlotType.SURFACE3D,
                expression=expression,
                variables=["x", "y"],
                ranges=ranges,
                source="agent",
            )
        )

    if expression and ("z=" in normalized or ("x" in normalized and "y" in normalized)):
        ranges = {"x": (-3, 3), "y": (-3, 3)}
        if "sqrt" in expression.lower() and "1" in expression:
            ranges = {"x": (-1, 1), "y": (-1, 1)}
        return _valid_plot_suggestion(
            PlotSuggestion(
                plot_type=PlotType.SURFACE3D,
                expression=expression,
                variables=["x", "y"],
                ranges=ranges,
                source="agent",
            )
        )

    if _looks_like_space_request(message, normalized):
        return None

    return None


def _input_source(request: ChatStreamRequest) -> str:
    return "ocr" if (request.confirmed_ocr_text or "").strip() else "text"


def _compact(message: str) -> str:
    return (
        message.lower()
        .replace(" ", "")
        .replace("＝", "=")
        .replace("，", ",")
        .replace("。", ".")
        .replace("：", ":")
    )


def _is_off_topic(message: str, normalized: str) -> bool:
    off_topic_tokens = [
        "天气",
        "新闻",
        "股票",
        "电影",
        "游戏",
        "菜单",
        "旅行",
        "澶╂皵",
        "鏂伴椈",
        "鑲＄エ",
        "鐢靛奖",
        "娓告垙",
        "鑿滆氨",
        "鏃呰",
        "weather",
        "stock",
        "movie",
    ]
    math_tokens = [
        "数学",
        "分析",
        "lim",
        "积分",
        "导数",
        "证明",
        "函数",
        "极限",
        "曲面",
        "区域",
        "鏁板",
        "鍒嗘瀽",
        "绉垎",
        "瀵兼暟",
        "璇佹槑",
        "鍑芥暟",
        "鏋侀檺",
        "鏇查潰",
        "鍖哄煙",
    ]
    return any(token in message or token in normalized for token in off_topic_tokens) and not any(
        token in message or token in normalized for token in math_tokens
    )


def _is_visualization_request(message: str, normalized: str) -> bool:
    return (
        any(token in message for token in VISUALIZATION_TOKENS)
        or any(token in normalized for token in ["draw", "graph", "visualize", "plot", "surface", "3d"])
        or "z=" in normalized
        or "z=" in _strip_latex_wrappers(message).replace(" ", "").lower()
        or _extract_implicit3d_equation(message) is not None
    )


def _needs_retrieval(message: str, question_type: QuestionType) -> bool:
    normalized = _compact(message)
    material_reference = any(token in message or token in normalized for token in MATERIAL_REFERENCE_TOKENS)
    course_topic = any(token in message or token in normalized for token in COURSE_TOPIC_TOKENS)
    if material_reference and question_type not in {QuestionType.OFF_TOPIC, QuestionType.VISUALIZATION}:
        return True
    if question_type in {QuestionType.OFF_TOPIC, QuestionType.VISUALIZATION}:
        return False
    if question_type == QuestionType.UNKNOWN:
        return material_reference or course_topic
    if any(token in message for token in SOURCE_TOKENS):
        return True
    if course_topic and question_type in {QuestionType.CONCEPTUAL, QuestionType.COMPUTATIONAL, QuestionType.PROOF, QuestionType.MIXED}:
        return True
    return question_type == QuestionType.CONCEPTUAL


def _needs_clarification(
    message: str,
    planning_text: str,
    question_type: QuestionType,
    plot_suggestion: PlotSuggestion | None,
) -> bool:
    normalized = message.strip().lower()
    broad_tokens = [
        "我完全不懂数学分析",
        "帮我学一下",
        "从头学",
        "怎么学",
        "学不会",
        "完全不懂",
        "涓嶆噦鏁板鍒嗘瀽",
        "甯垜瀛︿竴涓?",
        "浠庡ご瀛?",
        "鎬庝箞瀛?",
        "瀛︿笉浼?",
        "瀹屽叏涓嶆噦",
    ]
    if question_type == QuestionType.OFF_TOPIC:
        return True
    if len(normalized) < 4:
        return True
    if question_type == QuestionType.VISUALIZATION and _looks_like_space_request(planning_text, _compact(planning_text)) and plot_suggestion is None:
        return True
    return any(token in message for token in broad_tokens)


def _memory_action(message: str) -> str:
    if any(token in message for token in ["不懂", "不会", "卡住", "薄弱", "弱点", "涓嶆噦", "涓嶄細", "鍗′綇", "钖勫急", "寮辩偣"]):
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
    normalized = _strip_latex_wrappers(message).replace("＝", "=")
    if "=" not in normalized:
        return None

    candidates = re.findall(r"([A-Za-z0-9\\{}_^+\-*/().\s]+=[A-Za-z0-9\\{}_^+\-*/().\s]+)", normalized)
    for candidate in candidates:
        candidate = _trim_equation_prefix(candidate)
        compact = candidate.replace(" ", "").lower()
        if _is_integral_or_assignment_equation(candidate, compact):
            continue
        if re.match(r"^[z]\s*=", candidate.strip(), flags=re.IGNORECASE):
            continue
        if all(variable in compact for variable in ["x", "y", "z"]):
            cleaned = _clean_expression(candidate)
            if cleaned and _valid_plot_suggestion(
                PlotSuggestion(
                    plot_type=PlotType.IMPLICIT3D,
                    expression=cleaned,
                    variables=["x", "y", "z"],
                    ranges={"x": (-1.5, 1.5), "y": (-1.5, 1.5), "z": (-1.5, 1.5)},
                    source="agent",
                )
            ):
                return cleaned
    return None


def _trim_equation_prefix(candidate: str) -> str:
    equals_index = candidate.find("=")
    if equals_index < 0:
        return candidate.strip()
    left = candidate[:equals_index]
    variable_positions = [left.rfind(variable) for variable in ["x", "y", "z"]]
    found_positions = [position for position in variable_positions if position >= 0]
    if found_positions:
        start = min(found_positions)
        candidate = candidate[start:]
    return candidate.strip()


def _is_integral_or_assignment_equation(candidate: str, compact: str) -> bool:
    left = candidate.split("=", 1)[0].strip().lower()
    integral_markers = ["\\int", "\\iint", "\\iiint", "int_", "iint_", "iiint_", "mathrm(d", "mathrmd"]
    if any(marker in compact for marker in integral_markers):
        return True
    return left in {"i", "s"} or left.startswith(("i ", "s "))


def _looks_like_region2d(message: str) -> bool:
    normalized = _compact(message)
    mentions_region = "区域" in message or "鍖哄煙" in message or "region" in normalized
    return mentions_region and "x" in normalized and "y" in normalized and "<=" in normalized


def _looks_like_function2d(message: str, normalized: str) -> bool:
    if "z=" in normalized:
        return False
    return any(marker in normalized for marker in ["y=", "f(x)=", "graphof", "graphoff"])


def _looks_like_space_request(message: str, normalized: str) -> bool:
    return any(token in message for token in SPACE_TOKENS) or any(
        token in normalized for token in ["3d", "surface", "space", "spatial"]
    )


def _looks_like_upper_hemisphere(message: str, normalized: str) -> bool:
    return (
        ("上半球" in message or "半球面" in message or "涓婂崐鐞?" in message or "hemisphere" in normalized)
        and _looks_like_space_request(message, normalized)
    )


def _extract_region_expression(message: str) -> str:
    for marker in ["D:", "d:", "D：", "d：", "D锛?", "d锛?"]:
        if marker in message:
            return message.split(marker, 1)[1].replace("锛?", ",").strip()
    return "0<=x<=1, 0<=y<=x"


def _extract_expression_after_equals(message: str) -> str | None:
    cleaned = _strip_latex_wrappers(message).replace("＝", "=")
    patterns = [
        r"z\s*=\s*([^，。；;\n]+)",
        r"y\s*=\s*([^,，。；;\n]+)",
        r"f\s*\(\s*x\s*\)\s*=\s*([^,，。；;\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if match:
            return _clean_expression(match.group(1))
    return None


def _valid_plot_suggestion(suggestion: PlotSuggestion | None) -> PlotSuggestion | None:
    if suggestion is None:
        return None
    try:
        validate_plot_request(
            PlotPreviewRequest(
                plot_type=suggestion.plot_type,
                expression=suggestion.expression,
                variables=suggestion.variables,
                ranges=suggestion.ranges,
                source=suggestion.source,
            )
        )
    except PlotValidationError:
        return None
    return suggestion


def _strip_latex_wrappers(value: str) -> str:
    return (
        value.replace("\\(", " ")
        .replace("\\)", " ")
        .replace("\\[", " ")
        .replace("\\]", " ")
        .replace("$", " ")
    )


def _clean_expression(value: str) -> str:
    expression = value.strip()
    cjk_match = re.search(r"[\u4e00-\u9fff]", expression)
    if cjk_match:
        expression = expression[: cjk_match.start()]
    mojibake_match = re.search(r"\?{2,}", expression)
    if mojibake_match:
        expression = expression[: mojibake_match.start()]
    english_tail = re.search(
        r"\s+(?:as|for|please|with|over|on|showing|to)\b",
        expression,
        flags=re.IGNORECASE,
    )
    if english_tail:
        expression = expression[: english_tail.start()]
    for marker in [
        "的三维曲面",
        "的空间图形",
        "的图像",
        "三维曲面",
        "图像",
        "图形",
        "鐨勪笁缁存洸闈?",
        "鐨勫浘鍍?",
        "涓夌淮鏇查潰",
        "鍥惧儚",
        "graph",
        "plot",
        "please",
        "with",
    ]:
        expression = expression.replace(marker, " ")
    expression = expression.strip(" .。；;，,：:")
    expression = re.sub(r"\s+", " ", expression)
    return expression
