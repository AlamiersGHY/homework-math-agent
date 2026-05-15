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
    MIXED = "mixed"
    OCR_DERIVED = "ocr_derived"
    OFF_TOPIC = "off_topic"
    UNKNOWN = "unknown"


class PlotType(StrEnum):
    FUNCTION2D = "function2d"
    SURFACE3D = "surface3d"
    REGION2D = "region2d"


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody
