from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import AnswerMode, PlotType, QuestionType
from math_agent_api.services.agent_policy_planner import plan_agent_turn


def test_concept_question_prefers_retrieval_when_available() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="一致连续和普通连续有什么区别？", answer_mode="guided")
    )

    assert plan.question_type == QuestionType.CONCEPTUAL
    assert plan.needs_retrieval is True
    assert plan.retrieval_scope == "uploaded_course_materials"
    assert plan.needs_plot is False
    assert plan.needs_clarification is False
    assert plan.answer_mode == AnswerMode.GUIDED


def test_proof_question_keeps_guided_style_when_requested() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="证明闭区间上连续函数必有最大值", answer_mode="guided")
    )

    assert plan.question_type == QuestionType.PROOF
    assert plan.answer_mode == AnswerMode.GUIDED
    assert plan.needs_plot is False


def test_ocr_confirmed_text_drives_planner_instead_of_placeholder_message() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message="请帮我做这道题",
            confirmed_ocr_text="求 lim_{x\\to 0} \\frac{1-cos x}{x^2}",
            answer_mode="guided",
        )
    )

    assert plan.input_source == "ocr"
    assert plan.question_type == QuestionType.COMPUTATIONAL
    assert plan.needs_retrieval is False


def test_visualization_question_produces_plot_suggestion() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="画一下 z = sin(x*y) 的三维曲面", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.SURFACE3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "sin(x*y)"


def test_supported_implicit_surface_produces_implicit3d_suggestion() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="画出 x^4 + y^4 + z^4 = 1 的精确三维隐式曲面", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.IMPLICIT3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "x^4 + y^4 + z^4 = 1"


def test_broad_request_asks_for_clarification_and_records_weak_point() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="我完全不懂数学分析，帮我学一下", answer_mode="guided")
    )

    assert plan.question_type == QuestionType.UNKNOWN
    assert plan.needs_clarification is True
    assert plan.answer_mode == AnswerMode.GUIDED
    assert plan.memory_action == "record_weak_point"


def test_off_topic_request_asks_for_clarification_without_tools() -> None:
    plan = plan_agent_turn(ChatStreamRequest(message="今天北京天气怎么样？", answer_mode="direct"))

    assert plan.question_type == QuestionType.OFF_TOPIC
    assert plan.needs_clarification is True
    assert plan.needs_retrieval is False
    assert plan.needs_plot is False
