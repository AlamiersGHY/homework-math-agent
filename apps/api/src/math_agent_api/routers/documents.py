from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from math_agent_api.db.session import get_db_session
from math_agent_api.schemas.common import ErrorBody
from math_agent_api.schemas.documents import DocumentSummary, DocumentUploadResponse
from math_agent_api.services.document_service import (
    DocumentValidationError,
    delete_document,
    ingest_pdf_document,
    list_document_summaries,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db_session),
) -> DocumentUploadResponse | JSONResponse:
    try:
        content = await file.read()
        document = ingest_pdf_document(
            db=db,
            content=content,
            filename=file.filename or "uploaded.pdf",
            content_type=file.content_type,
        )
    except DocumentValidationError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": ErrorBody(
                    code="document_validation_error",
                    message=str(exc),
                ).model_dump(mode="json")
            },
        )
    return DocumentUploadResponse(document=document)


@router.get("", response_model=list[DocumentSummary])
async def list_documents(db: Session = Depends(get_db_session)) -> list[DocumentSummary]:
    return list_document_summaries(db)


@router.delete("/{document_id}", response_model=None)
async def remove_document(document_id: str, db: Session = Depends(get_db_session)) -> Response | JSONResponse:
    deleted = delete_document(db, document_id)
    if not deleted:
        return JSONResponse(
            status_code=404,
            content={
                "error": ErrorBody(
                    code="document_not_found",
                    message="Document not found.",
                ).model_dump(mode="json")
            },
        )
    return Response(status_code=204)
