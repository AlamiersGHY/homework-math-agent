from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from math_agent_api.providers.ocr import OCRProviderError
from math_agent_api.schemas.common import ErrorBody
from math_agent_api.schemas.ocr import OCRRecognizeResponse
from math_agent_api.services.ocr_service import OCRValidationError, recognize_image

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/recognize", response_model=OCRRecognizeResponse)
async def recognize_ocr(
    file: UploadFile = File(...),
    provider: str | None = Form(default=None),
) -> OCRRecognizeResponse | JSONResponse:
    image_bytes = await file.read()
    try:
        return await recognize_image(
            image_bytes=image_bytes,
            content_type=file.content_type,
            filename=file.filename or "upload",
            provider_name=provider,
        )
    except OCRValidationError as exc:
        return _error_response("ocr_validation_error", str(exc), status_code=400)
    except OCRProviderError:
        return _error_response(
            "ocr_provider_error",
            "OCR provider failed. Check OCR configuration or try again later.",
            status_code=502,
        )


def _error_response(code: str, message: str, status_code: int) -> JSONResponse:
    body = {"error": ErrorBody(code=code, message=message).model_dump(mode="json")}
    return JSONResponse(status_code=status_code, content=body)
