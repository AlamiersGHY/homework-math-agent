from pydantic import BaseModel, Field


class OCRRecognizeResponse(BaseModel):
    recognized_text: str
    confidence: float | None = None
    provider: str
    warnings: list[str] = Field(default_factory=list)
