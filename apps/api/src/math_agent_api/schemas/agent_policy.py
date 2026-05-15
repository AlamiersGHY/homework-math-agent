from typing import Literal

from pydantic import BaseModel, Field

from math_agent_api.schemas.common import AnswerMode, PlotType, QuestionType


class PlotSuggestion(BaseModel):
    plot_type: PlotType
    expression: str
    variables: list[str]
    ranges: dict[str, tuple[float, float]]
    source: Literal["agent", "planner", "eval"] = "agent"


class AgentPolicyPlan(BaseModel):
    question_type: QuestionType
    needs_retrieval: bool = False
    needs_plot: bool = False
    needs_clarification: bool = False
    answer_mode: AnswerMode
    retrieval_scope: Literal["none", "uploaded_course_materials"] = "none"
    plot_type: PlotType | None = None
    plot_suggestion: PlotSuggestion | None = None
    memory_action: Literal["none", "record_weak_point", "record_preference"] = "none"
    input_source: Literal["text", "ocr"] = "text"
    reason: str = Field(min_length=1)

    def plot_suggestion_payload(self) -> dict | None:
        if self.plot_suggestion is None:
            return None
        return self.plot_suggestion.model_dump(mode="json")
