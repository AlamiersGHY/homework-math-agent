from math_agent_api.providers.ocr import OCRProviderError, get_ocr_provider
from math_agent_api.schemas.ocr import OCRRecognizeResponse

MAX_IMAGE_BYTES = 8 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
}


class OCRValidationError(Exception):
    pass


async def recognize_image(
    image_bytes: bytes,
    content_type: str | None,
    filename: str,
    provider_name: str | None = None,
) -> OCRRecognizeResponse:
    resolved_type = (content_type or "").lower()
    if not image_bytes:
        raise OCRValidationError("Uploaded image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise OCRValidationError("Uploaded image is too large for the MVP OCR flow.")
    if resolved_type not in SUPPORTED_IMAGE_TYPES:
        raise OCRValidationError("Unsupported image type. Use PNG, JPEG, WEBP, or GIF.")

    provider = get_ocr_provider()
    if provider_name:
        # Provider selection remains backend-owned. The optional request field is used only
        # to support future manual smoke tests once multiple real providers are enabled.
        requested = provider_name.strip().lower()
        if requested and requested != provider.name:
            raise OCRValidationError(f"Requested OCR provider '{requested}' is not active.")

    return await provider.recognize(
        image_bytes=image_bytes,
        content_type=resolved_type,
        filename=filename,
    )
