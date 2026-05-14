from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AnswerMode(StrEnum):
    DIRECT = "direct"
    GUIDED = "guided"
    HINT = "hint"


class QuestionType(StrEnum):
    CONCEPTUAL = "conceptual"
    COMPUTATIONAL = "computational"
    PROOF = "proof"
    VISUALIZATION = "visualization"
    UNKNOWN = "unknown"


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody
