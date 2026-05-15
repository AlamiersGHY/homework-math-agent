from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
API_SRC = REPO_ROOT / "apps" / "api" / "src"
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))

from math_agent_api.schemas.chat import ChatStreamRequest  # noqa: E402
from math_agent_api.schemas.common import PlotType  # noqa: E402
from math_agent_api.schemas.plots import PlotPreviewRequest  # noqa: E402
from math_agent_api.services.agent_policy_planner import plan_agent_turn  # noqa: E402
from math_agent_api.services.plot_service import (  # noqa: E402
    PlotValidationError,
    create_plot_preview,
)


@dataclass
class EvalFailure:
    case_id: str
    message: str


def load_cases(relative_path: str) -> list[dict[str, Any]]:
    path = REPO_ROOT / relative_path
    return json.loads(path.read_text(encoding="utf-8"))


def active_message(case: dict[str, Any]) -> str:
    payload = case["input"]
    return payload.get("confirmed_ocr_text") or payload["message"]


def build_request(case: dict[str, Any]) -> ChatStreamRequest:
    payload = case["input"]
    return ChatStreamRequest(
        message=payload["message"],
        confirmed_ocr_text=payload.get("confirmed_ocr_text"),
        answer_mode=payload.get("answer_mode", "guided"),
    )


def check_agent_case(case: dict[str, Any]) -> list[EvalFailure]:
    failures: list[EvalFailure] = []
    expected = case.get("expected", {})
    plan = plan_agent_turn(build_request(case))
    plot_suggestion = plan.plot_suggestion_payload()

    if "question_type" in expected and plan.question_type != expected["question_type"]:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected question_type={expected['question_type']}, got {plan.question_type}",
            )
        )

    if "answer_mode" in expected:
        if plan.answer_mode != expected["answer_mode"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected answer_mode={expected['answer_mode']}, got {plan.answer_mode}",
                )
            )

    if "should_visualize" in expected:
        actual = plan.needs_plot
        if actual != expected["should_visualize"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected should_visualize={expected['should_visualize']}, got {actual}",
                )
            )

    if "plot_type" in expected:
        actual_plot_type = plan.plot_type.value if plan.plot_type else None
        if actual_plot_type != expected["plot_type"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected plot_type={expected['plot_type']}, got {actual_plot_type}",
                )
            )

    expected_retrieval = expected.get("needs_retrieval", expected.get("requires_retrieval"))
    if expected_retrieval is not None and plan.needs_retrieval != expected_retrieval:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected needs_retrieval={expected_retrieval}, got {plan.needs_retrieval}",
            )
        )

    if "needs_clarification" in expected and plan.needs_clarification != expected["needs_clarification"]:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected needs_clarification={expected['needs_clarification']}, got {plan.needs_clarification}",
            )
        )

    if "memory_action" in expected and plan.memory_action != expected["memory_action"]:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected memory_action={expected['memory_action']}, got {plan.memory_action}",
            )
        )

    return failures


def check_visual_case(case: dict[str, Any]) -> list[EvalFailure]:
    failures: list[EvalFailure] = []
    expected = case.get("expected", {})
    plan = plan_agent_turn(build_request(case))
    plot_suggestion = plan.plot_suggestion_payload()
    should_visualize = plan.needs_plot

    if should_visualize != expected.get("should_visualize"):
        failures.append(
            EvalFailure(
                case["id"],
                f"expected should_visualize={expected.get('should_visualize')}, got {should_visualize}",
            )
        )

    actual_plot_type = plan.plot_type.value if plan.plot_type else None
    if actual_plot_type != expected.get("plot_type"):
        failures.append(
            EvalFailure(
                case["id"],
                f"expected plot_type={expected.get('plot_type')}, got {actual_plot_type}",
            )
        )

    if not plot_suggestion:
        return failures

    if "variables" in expected and plot_suggestion.get("variables") != expected["variables"]:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected variables={expected['variables']}, got {plot_suggestion.get('variables')}",
            )
        )

    expected_expression = case.get("input", {}).get("expression")
    if expected_expression and plot_suggestion.get("expression") != expected_expression:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected expression={expected_expression}, got {plot_suggestion.get('expression')}",
            )
        )

    if expected.get("renderer") == "plotly":
        try:
            preview = create_plot_preview(
                PlotPreviewRequest(
                    plot_type=PlotType(plot_suggestion["plot_type"]),
                    expression=plot_suggestion["expression"],
                    variables=plot_suggestion["variables"],
                    ranges=plot_suggestion["ranges"],
                    source=plot_suggestion.get("source", "eval"),
                )
            )
        except (PlotValidationError, ValueError) as exc:
            failures.append(EvalFailure(case["id"], f"plot preview failed: {exc}"))
        else:
            if preview.renderer != "plotly":
                failures.append(
                    EvalFailure(case["id"], f"expected renderer=plotly, got {preview.renderer}")
                )

    return failures


def main() -> int:
    checks: list[tuple[str, list[dict[str, Any]], Any]] = [
        ("agent", load_cases("evals/agent_cases.json"), check_agent_case),
        ("visual", load_cases("evals/visual_cases.json"), check_visual_case),
    ]
    failures: list[EvalFailure] = []

    for name, cases, checker in checks:
        print(f"{name}: {len(cases)} cases")
        for case in cases:
            case_failures = checker(case)
            if case_failures:
                failures.extend(case_failures)
                print(f"  FAIL {case['id']}")
            else:
                print(f"  PASS {case['id']}")

    if failures:
        print("")
        print("Eval failures:")
        for failure in failures:
            print(f"- {failure.case_id}: {failure.message}")
        return 1

    print("")
    print("All evals passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
