from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import AnswerMode, QuestionType
from math_agent_api.schemas.retrieval import RetrievedSource


def _mode_instruction(answer_mode: AnswerMode) -> str:
    if answer_mode == AnswerMode.DIRECT:
        return "用户选择 direct：先给明确答案，再用必要步骤解释，不要强制苏格拉底式追问。"
    if answer_mode == AnswerMode.HINT:
        return "用户选择 hint：只给关键提示和下一步方向，避免直接给完整答案。"
    return "用户选择 guided：分步引导，先指出思路和下一步，不要一次性写成长篇完整解答。"


def build_chat_messages(
    request: ChatStreamRequest,
    question_type: QuestionType,
    answer_mode: AnswerMode | None = None,
    retrieved_sources: list[RetrievedSource] | None = None,
) -> list[dict[str, str]]:
    problem = request.confirmed_ocr_text or request.message
    resolved_mode = answer_mode or request.answer_mode
    system = "\n".join(
        [
            "你是一个面向工科本科数学分析学习者的学习 Agent。",
            "你的目标不是泛泛聊天，而是帮助用户理解数学分析中的概念、计算、证明和可视化问题。",
            _mode_instruction(resolved_mode),
            f"后端初步识别题型为 {question_type.value}，你可以参考但不要机械服从。",
            "数学表达必须使用 Markdown + LaTeX：行内公式一律写成 `$...$`，独立公式一律写成 `$$...$$`。",
            "不要输出裸露的 `\\frac`、`\\lim`、`\\sin` 等 LaTeX 命令；不要用 `[ ... ]` 包公式。",
            "三角函数和变量之间要留清楚边界，例如写 `$\\sin x$`、`$\\frac{\\sin x}{x}$`，不要写成 `sinxsinx`。",
            "如果没有检索上下文，不要编造教材页码、定理编号或资料来源。",
            "如果提供了检索材料，只能依据材料块中给出的 source_index、filename、pages 和 section 生成来源说明。",
            "如果题目需要图形理解，可以在文字中提示可视化价值，但不要假装已经渲染出图。",
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
