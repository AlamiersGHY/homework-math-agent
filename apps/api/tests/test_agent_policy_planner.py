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


def test_english_surface_request_strips_explanatory_tail() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="Plot z = sin(x*y) as a 3D surface.", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.SURFACE3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "sin(x*y)"


def test_english_graph_request_produces_function_plot_suggestion() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="Draw the graph of y = sin(x).", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.FUNCTION2D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "sin(x)"


def test_supported_implicit_surface_produces_implicit3d_suggestion() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="画出 x^4 + y^4 + z^4 = 1 的精确三维隐式曲面", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.IMPLICIT3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "x^4 + y^4 + z^4 = 1"


def test_upper_hemisphere_request_produces_surface_plot_suggestion() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="请顺便帮我画出上半球面的三维空间图", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.SURFACE3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "sqrt(a^2 - x^2 - y^2)"


def test_ocr_surface_integral_uses_geometry_surface_not_integral_assignment() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message="请根据图片内容帮我分析这道题",
            confirmed_ocr_text=(
                r"计算曲面积分 $I = \iint_{\Sigma} (x - x^{3}) \mathrm{d}y\mathrm{d}z "
                r"+ (y - y^{3}) \mathrm{d}z\mathrm{d}x + (z - z^{3}) \mathrm{d}x\mathrm{d}y$，"
                r"其中 $\Sigma$ 是半球面 $z = \sqrt{1 - x^{2} - y^{2}}$ 的上侧。"
            ),
            answer_mode="direct",
        )
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.SURFACE3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == r"\sqrt{1 - x^{2} - y^{2}}"
    assert plan.plot_suggestion.ranges == {"x": (-1.0, 1.0), "y": (-1.0, 1.0)}


def test_integral_assignment_without_surface_does_not_emit_invalid_implicit_plot() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message=(
                r"这个三重积分区域想象不出来：$I=\iiint_\Omega (x+y+z)\,\mathrm{d}V$，"
                r"请解释一下。"
            ),
            answer_mode="direct",
        )
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is False
    assert plan.plot_suggestion is None


def test_course_topic_without_explicit_source_still_prefers_retrieval() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="解释一下复合函数求导法则", answer_mode="guided")
    )

    assert plan.needs_retrieval is True
    assert plan.retrieval_scope == "uploaded_course_materials"


def test_chinese_spatial_surface_request_produces_surface3d() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message="这个几何曲面想象不出来：z = x^2 - y^2，帮我看空间图形",
            answer_mode="direct",
        )
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.SURFACE3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "x^2 - y^2"


def test_chinese_spatial_implicit_request_produces_implicit3d() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message="这个空间图形想象不出来：x^2 + y^2 + z^2 = 1",
            answer_mode="direct",
        )
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.IMPLICIT3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "x^2 + y^2 + z^2 = 1"


def test_spatial_request_without_expression_asks_clarification_without_sin_fallback() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="这个几何曲面想象不出来", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_clarification is True
    assert plan.needs_plot is False
    assert plan.plot_suggestion is None


def test_implicit_equation_can_have_variables_on_right_side() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(message="z^2 = 1 - x^2 - y^2 的空间图形", answer_mode="direct")
    )

    assert plan.question_type == QuestionType.VISUALIZATION
    assert plan.needs_plot is True
    assert plan.plot_type == PlotType.IMPLICIT3D
    assert plan.plot_suggestion is not None
    assert plan.plot_suggestion.expression == "z^2 = 1 - x^2 - y^2"


def test_contextual_spatial_request_uses_previous_equation() -> None:
    plan = plan_agent_turn(
        ChatStreamRequest(
            message="这个几何曲面想象不出来",
            answer_mode="direct",
            context={
                "previous_turns": [
                    {"role": "user", "content": "x^4 + y^4 + z^4 = 1"}
                ]
            },
        )
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
