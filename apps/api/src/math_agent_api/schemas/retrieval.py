from pydantic import BaseModel, Field


class RetrievalSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=10)


class RetrievedSource(BaseModel):
    source_index: int
    score: float
    chunk_id: str
    document_id: str
    filename: str
    page_start: int
    page_end: int
    section_title: str | None = None
    snippet: str


class RetrievalSearchResponse(BaseModel):
    query: str
    results: list[RetrievedSource] = []
