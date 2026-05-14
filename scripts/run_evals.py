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

from math_agent_api.schemas.common import PlotType  # noqa: E402
from math_agent_api.schemas.plots import PlotPreviewRequest  # noqa: E402
from math_agent_api.services.chat_service import (  # noqa: E402
    classify_question,
    create_plot_suggestion,
)
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


def check_agent_case(case: dict[str, Any]) -> list[EvalFailure]:
    failures: list[EvalFailure] = []
    expected = case.get("expected", {})
    message = active_message(case)
    question_type = classify_question(message)
    plot_suggestion = create_plot_suggestion(message, question_type)

    if "question_type" in expected and question_type != expected["question_type"]:
        failures.append(
            EvalFailure(
                case["id"],
                f"expected question_type={expected['question_type']}, got {question_type}",
            )
        )

    if "answer_mode" in expected:
        actual_mode = case["input"].get("answer_mode")
        if actual_mode != expected["answer_mode"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected answer_mode={expected['answer_mode']}, got {actual_mode}",
                )
            )

    if "should_visualize" in expected:
        actual = plot_suggestion is not None
        if actual != expected["should_visualize"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected should_visualize={expected['should_visualize']}, got {actual}",
                )
            )

    if "plot_type" in expected:
        actual_plot_type = plot_suggestion.get("plot_type") if plot_suggestion else None
        if actual_plot_type != expected["plot_type"]:
            failures.append(
                EvalFailure(
                    case["id"],
                    f"expected plot_type={expected['plot_type']}, got {actual_plot_type}",
                )
            )

    return failures


def check_visual_case(case: dict[str, Any]) -> list[EvalFailure]:
    failures: list[EvalFailure] = []
    expected = case.get("expected", {})
    message = active_message(case)
    question_type = classify_question(message)
    plot_suggestion = create_plot_suggestion(message, question_type)
    should_visualize = plot_suggestion is not None

    if should_visualize != expected.get("should_visualize"):
        failures.append(
            EvalFailure(
                case["id"],
                f"expected should_visualize={expected.get('should_visualize')}, got {should_visualize}",
            )
        )

    actual_plot_type = plot_suggestion.get("plot_type") if plot_suggestion else None
    if actual_plot_type != expected.get("plot_type"):
        failures.append(
            EvalFailure(
                case["id"],
                f"expected plot_type={expected.get('plot_type')}, got {actual_plot_type}",
            )
        )

    if not plot_suggestion:
        return failures

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
