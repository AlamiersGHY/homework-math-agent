import hashlib
import json
import re

from sqlalchemy.orm import Session

from math_agent_api.db.models import DocumentRecord
from math_agent_api.db.repositories import DocumentRepository
from math_agent_api.providers.document_parser import DocumentParserError, get_document_parser
from math_agent_api.schemas.documents import DocumentSummary

MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
MAX_CHUNK_CHARS = 1400
CHUNK_OVERLAP_CHARS = 180


class DocumentValidationError(Exception):
    pass


def ingest_pdf_document(
    db: Session,
    content: bytes,
    filename: str,
    content_type: str | None,
) -> DocumentSummary:
    _validate_pdf_upload(content, filename, content_type)
    resolved_type = content_type or "application/pdf"
    file_hash = hashlib.sha256(content).hexdigest()
    repo = DocumentRepository(db)
    existing = repo.get_document_by_hash(file_hash)
    if existing:
        return summarize_document(repo, existing)

    try:
        parsed = get_document_parser().parse_pdf(content)
    except DocumentParserError as exc:
        record = repo.create_document(
            filename=filename,
            content_type=resolved_type,
            file_hash=file_hash,
            page_count=None,
            status="failed",
            error_message=str(exc),
        )
        return summarize_document(repo, record)

    chunks = _build_chunks(parsed.pages)
    status = "ready" if chunks else "failed"
    error_message = None if chunks else "PDF has no extractable text."
    record = repo.create_document(
        filename=filename,
        content_type=resolved_type,
        file_hash=file_hash,
        page_count=parsed.page_count,
        status=status,
        error_message=error_message,
        warnings_json=json.dumps(parsed.warnings, ensure_ascii=False),
    )
    if chunks:
        repo.replace_chunks(record.id, chunks)
        record = repo.get_document(record.id) or record
    return summarize_document(repo, record)


def list_document_summaries(db: Session) -> list[DocumentSummary]:
    repo = DocumentRepository(db)
    return [summarize_document(repo, record) for record in repo.list_documents()]


def delete_document(db: Session, document_id: str) -> bool:
    return DocumentRepository(db).delete_document(document_id)


def summarize_document(repo: DocumentRepository, record: DocumentRecord) -> DocumentSummary:
    return DocumentSummary(
        id=record.id,
        filename=record.filename,
        content_type=record.content_type,
        status=record.status if record.status in {"ready", "failed"} else "failed",
        page_count=record.page_count,
        chunk_count=repo.chunk_count(record.id),
        warnings=_load_warnings(record.warnings_json),
        error_message=record.error_message,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _validate_pdf_upload(content: bytes, filename: str, content_type: str | None) -> None:
    if not content:
        raise DocumentValidationError("Uploaded PDF is empty.")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise DocumentValidationError("Uploaded PDF is too large for the local demo.")
    lower_name = filename.lower()
    resolved_type = (content_type or "").lower()
    if not lower_name.endswith(".pdf") and resolved_type != "application/pdf":
        raise DocumentValidationError("Only PDF course materials are supported in this version.")


def _build_chunks(pages) -> list[dict]:
    chunks: list[dict] = []
    for page in pages:
        text = _clean_text(page.text)
        if not text:
            continue
        for part in _split_text(text):
            text_hash = hashlib.sha256(part.encode("utf-8")).hexdigest()
            chunks.append(
                {
                    "chunk_index": len(chunks),
                    "page_start": page.page_number,
                    "page_end": page.page_number,
                    "section_title": _guess_section_title(part),
                    "text": part,
                    "text_hash": text_hash,
                    "token_estimate": max(1, len(part) // 4),
                    "summary": _summarize_chunk(part),
                    "retrieval_text": _normalize_for_retrieval(part),
                }
            )
    return chunks


def _split_text(text: str) -> list[str]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + MAX_CHUNK_CHARS)
        boundary = max(text.rfind("\n", start, end), text.rfind("。", start, end), text.rfind(".", start, end))
        if boundary > start + 300:
            end = boundary + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - CHUNK_OVERLAP_CHARS)
    return [chunk for chunk in chunks if chunk]


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_for_retrieval(text: str) -> str:
    return _clean_text(text).lower()


def _guess_section_title(text: str) -> str | None:
    first = text.split(". ", 1)[0].strip()
    if 4 <= len(first) <= 80 and any(token in first.lower() for token in ["definition", "theorem", "定理", "定义"]):
        return first
    return None


def _summarize_chunk(text: str) -> str:
    return text[:220]


def _load_warnings(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    return [item for item in value if isinstance(item, str)]
