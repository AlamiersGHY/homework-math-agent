import math
import re
from collections import Counter

from sqlalchemy.orm import Session

from math_agent_api.db.models import DocumentChunkRecord
from math_agent_api.db.repositories import DocumentRepository
from math_agent_api.schemas.retrieval import RetrievedSource, RetrievalSearchResponse

MIN_SCORE = 0.12


def search_retrieval(
    db: Session,
    query: str,
    top_k: int = 5,
    min_score: float = MIN_SCORE,
) -> RetrievalSearchResponse:
    normalized_query = query.strip()
    query_terms = _tokenize(normalized_query)
    if not query_terms:
        return RetrievalSearchResponse(query=query, results=[])

    repo = DocumentRepository(db)
    scored: list[tuple[float, DocumentChunkRecord]] = []
    for chunk in repo.list_ready_chunks():
        score = _score_chunk(query_terms, normalized_query, chunk.retrieval_text)
        if score >= min_score:
            scored.append((score, chunk))

    scored.sort(key=lambda item: (-item[0], item[1].document.filename, item[1].chunk_index))
    results = [
        _source_from_chunk(index=index + 1, score=score, chunk=chunk, query_terms=query_terms)
        for index, (score, chunk) in enumerate(scored[:top_k])
    ]
    return RetrievalSearchResponse(query=query, results=results)


def _score_chunk(query_terms: list[str], query: str, retrieval_text: str) -> float:
    chunk_terms = _tokenize(retrieval_text)
    if not chunk_terms:
        return 0
    query_counter = Counter(query_terms)
    chunk_counter = Counter(chunk_terms)
    overlap = sum(min(chunk_counter[term], count) for term, count in query_counter.items())
    coverage = overlap / max(1, len(query_counter))
    density = overlap / math.sqrt(len(chunk_terms))
    phrase_bonus = 0.25 if query.lower() in retrieval_text.lower() else 0
    return coverage + density + phrase_bonus


def _source_from_chunk(
    index: int,
    score: float,
    chunk: DocumentChunkRecord,
    query_terms: list[str],
) -> RetrievedSource:
    document = chunk.document
    return RetrievedSource(
        source_index=index,
        score=round(score, 4),
        chunk_id=chunk.id,
        document_id=document.id,
        filename=document.filename,
        page_start=chunk.page_start,
        page_end=chunk.page_end,
        section_title=chunk.section_title,
        snippet=_snippet(chunk.text, query_terms),
    )


def _tokenize(text: str) -> list[str]:
    normalized = text.lower()
    latin_terms = re.findall(r"[a-z0-9_]+", normalized)
    cjk_terms = re.findall(r"[\u4e00-\u9fff]{2,}", normalized)
    short_cjk_terms: list[str] = []
    for term in cjk_terms:
        short_cjk_terms.extend(term[index : index + 2] for index in range(max(0, len(term) - 1)))
    return latin_terms + cjk_terms + short_cjk_terms


def _snippet(text: str, query_terms: list[str], window: int = 180) -> str:
    lowered = text.lower()
    positions = [lowered.find(term) for term in query_terms if lowered.find(term) >= 0]
    if positions:
        center = min(positions)
        start = max(0, center - window // 2)
        end = min(len(text), start + window)
    else:
        start = 0
        end = min(len(text), window)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = f"...{snippet}"
    if end < len(text):
        snippet = f"{snippet}..."
    return snippet
