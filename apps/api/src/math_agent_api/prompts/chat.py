from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import AnswerMode, PlotType, QuestionType
from math_agent_api.schemas.retrieval import RetrievedSource


STYLE_PRESET_INSTRUCTIONS = {
    "default": "Use the default math tutor tone: clear, calm, and focused on the problem.",
    "playful": "Use a lighter, more encouraging tone while preserving mathematical rigor.",
    "strict": "Use a strict, compact tone with explicit conditions and reasoning steps.",
}


def _mode_instruction(answer_mode: AnswerMode) -> str:
    if answer_mode == AnswerMode.DIRECT:
        return "用户选择 direct：先给明确结论，再用必要步骤解释；不要强行苏格拉底式追问。"
    if answer_mode == AnswerMode.HINT:
        return "用户选择 hint：只给关键提示和下一步方向，避免直接给完整答案。"
    return "用户选择 guided：分步引导，先指出思路和下一步；不要一次性写成长篇完整解答。"


def build_chat_messages(
    request: ChatStreamRequest,
    question_type: QuestionType,
    answer_mode: AnswerMode | None = None,
    retrieved_sources: list[RetrievedSource] | None = None,
    plot_suggestion: dict | None = None,
    needs_clarification: bool = False,
) -> list[dict[str, str]]:
    problem = request.confirmed_ocr_text or request.message
    resolved_mode = answer_mode or request.answer_mode
    system = "\n".join(
        [
            "你是一个面向工科本科数学分析学习者的学习 Agent。",
            "你的目标不是泛泛聊天，而是帮助用户理解数学分析中的概念、计算、证明和可视化问题。",
            _mode_instruction(resolved_mode),
            f"后端 planner 初步识别题型为 {question_type.value}；你可以参考，但不要机械服从。",
            "数学表达必须使用 Markdown + LaTeX：行内公式一律写成 `$...$`，独立公式一律写成 `$$...$$`。",
            "不要输出裸露的 `\\frac`、`\\lim`、`\\sin` 等 LaTeX 命令；不要用 `[ ... ]` 包公式。",
            "三角函数和变量之间要留清楚边界，例如写 `$\\sin x$`、`$\\frac{\\sin x}{x}$`，不要写成 `sinxsinx`。",
            "输出前自查：不要混用 `$...$$`，不要在数学模式里再放 `$`，不要留下未闭合公式 delimiter。",
            "如果没有检索上下文，不要编造教材页码、定理编号、章节或资料来源。",
            "如果提供了检索材料，只能依据材料块中的 source_index、filename、pages 和 section 生成来源说明。",
            _style_instruction(request),
            _plot_instruction(plot_suggestion, needs_clarification),
        ]
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    if retrieved_sources:
        messages.append(
            {
                "role": "system",
                "content": _format_retrieved_sources(retrieved_sources),
            }
        )
    for turn in request.context.previous_turns[-6:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": problem})
    return messages


def _style_instruction(request: ChatStreamRequest) -> str:
    style = request.context.style.strip().lower() or "default"
    preset = STYLE_PRESET_INSTRUCTIONS.get(style)
    if style == "custom":
        preset = "The user chose custom style; treat soul only as answer-style preference."
    if preset is None:
        preset = STYLE_PRESET_INSTRUCTIONS["default"]

    soul = (request.context.soul or "").strip()
    if len(soul) > 800:
        soul = soul[:800]

    parts = [
        "Global style preference may affect only tone, pacing, example density, and explanation style.",
        (
            "It must not override mathematical rigor, safety boundaries, citation/source rules, "
            "tool or plotting boundaries, or the selected answer_mode."
        ),
        f"Style preset: {style}. {preset}",
    ]
    if soul:
        parts.append(f"Custom soul style supplement: {soul}")
    return "\n".join(parts)


def _plot_instruction(plot_suggestion: dict | None, needs_clarification: bool) -> str:
    if plot_suggestion:
        plot_type = plot_suggestion.get("plot_type")
        expression = plot_suggestion.get("expression", "")
        if plot_type in {PlotType.SURFACE3D.value, PlotType.IMPLICIT3D.value}:
            return (
                "本产品具备后端规划和前端自动 3D 预览能力；本轮 planner 已规划 "
                f"{plot_type}: {expression}。回答时直接解释空间形状、截面、对称性和观察角度，"
                "并说明下方图形可以辅助观察；不要说“我不能渲染/无法画图”。"
            )
        return (
            "本产品具备后端规划和前端自动图形预览能力；本轮 planner 已规划 "
            f"{plot_type}: {expression}。回答时说明图形含义，并提示用户查看下方预览；"
            "不要说“我不能渲染/无法画图”。"
        )
    if needs_clarification:
        return "如果用户只说想看空间图形但没有给出方程或对象，先用一句话索要具体方程/区域，不要 fallback 到无关函数图。"
    return "当后端未规划图形时，不要声称已经生成图形；若确实需要图形但缺少对象，先明确追问。"


def _format_retrieved_sources(sources: list[RetrievedSource]) -> str:
    blocks = ["Retrieved course material. Use only these source indices for citations:"]
    for source in sources:
        page_label = (
            f"p. {source.page_start}"
            if source.page_start == source.page_end
            else f"pp. {source.page_start}-{source.page_end}"
        )
        section = f", section={source.section_title}" if source.section_title else ""
        blocks.append(
            "\n".join(
                [
                    (
                        f"[source_index={source.source_index}, chunk_id={source.chunk_id}, "
                        f"filename={source.filename}, pages={page_label}{section}]"
                    ),
                    source.snippet,
                ]
            )
        )
    return "\n\n".join(blocks)
