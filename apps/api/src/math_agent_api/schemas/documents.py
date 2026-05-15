from datetime import datetime
from typing import Literal

from pydantic import BaseModel


DocumentStatus = Literal["ready", "failed"]


class DocumentSummary(BaseModel):
    id: str
    filename: str
    content_type: str
    status: DocumentStatus
    page_count: int | None = None
    chunk_count: int = 0
    warnings: list[str] = []
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentUploadResponse(BaseModel):
    document: DocumentSummary
