import base64
from dataclasses import dataclass
from typing import Protocol

import httpx

from math_agent_api.core.config import Settings, get_settings
from math_agent_api.schemas.ocr import OCRRecognizeResponse


class OCRProviderError(Exception):
    pass


class OCRProvider(Protocol):
    name: str

    async def recognize(self, image_bytes: bytes, content_type: str, filename: str) -> OCRRecognizeResponse:
        pass


@dataclass(frozen=True)
class MockOCRProvider:
    name: str = "mock"

    async def recognize(
        self,
        image_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OCRRecognizeResponse:
        warning = "当前使用 mock OCR；填入真实 OCR 配置后可切换到 Doubao Vision。"
        return OCRRecognizeResponse(
            recognized_text="求 $\\lim_{x\\to 0}\\frac{\\sin x}{x}$，并说明关键步骤。",
            confidence=0.91,
            provider=self.name,
            warnings=[warning],
        )


@dataclass(frozen=True)
class DoubaoVisionOCRProvider:
    base_url: str
    api_key: str
    model: str
    timeout_seconds: float
    name: str = "doubao_vision"

    async def recognize(
        self,
        image_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OCRRecognizeResponse:
        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        data_url = _build_data_url(image_bytes, content_type)
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "请识别图片中的数学题目或推导。只返回可编辑的题目文本，"
                                "公式使用 Markdown LaTeX 分隔符，不要添加解题过程。"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                    ],
                }
            ],
            "temperature": 0,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(self.timeout_seconds, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(endpoint, json=payload, headers=headers)
                if response.status_code >= 400:
                    raise OCRProviderError(
                        f"Doubao OCR returned {response.status_code}: {response.text[:300]}"
                    )
                body = response.json()
            except httpx.HTTPError as exc:
                raise OCRProviderError("Doubao OCR request failed") from exc
            except ValueError as exc:
                raise OCRProviderError("Doubao OCR returned invalid JSON") from exc

        text = _extract_openai_compatible_text(body)
        if not text:
            raise OCRProviderError("Doubao OCR returned an empty recognition result")

        return OCRRecognizeResponse(
            recognized_text=text,
            confidence=None,
            provider=self.name,
            warnings=[],
        )


@dataclass(frozen=True)
class MathpixOCRProvider:
    api_url: str
    app_id: str
    app_key: str
    timeout_seconds: float
    name: str = "mathpix"

    async def recognize(
        self,
        image_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OCRRecognizeResponse:
        payload = {
            "src": _build_data_url(image_bytes, content_type),
            "formats": ["text"],
            "data_options": {"include_asciimath": False, "include_latex": True},
        }
        headers = {
            "app_id": self.app_id,
            "app_key": self.app_key,
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(self.timeout_seconds, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(self.api_url, json=payload, headers=headers)
                if response.status_code >= 400:
                    raise OCRProviderError(
                        f"Mathpix OCR returned {response.status_code}: {response.text[:300]}"
                    )
                body = response.json()
            except httpx.HTTPError as exc:
                raise OCRProviderError("Mathpix OCR request failed") from exc
            except ValueError as exc:
                raise OCRProviderError("Mathpix OCR returned invalid JSON") from exc

        text = str(body.get("text") or "").strip()
        if not text:
            raise OCRProviderError("Mathpix OCR returned an empty recognition result")

        confidence = body.get("confidence")
        return OCRRecognizeResponse(
            recognized_text=text,
            confidence=confidence if isinstance(confidence, int | float) else None,
            provider=self.name,
            warnings=[],
        )


def get_ocr_provider(settings: Settings | None = None) -> OCRProvider:
    resolved = settings or get_settings()
    provider_name = resolved.ocr_provider.strip().lower()

    if provider_name in {"mock", "none"}:
        return MockOCRProvider()

    if provider_name == "doubao_vision" and resolved.has_doubao_ocr_credentials:
        return DoubaoVisionOCRProvider(
            base_url=resolved.doubao_base_url,
            api_key=resolved.doubao_api_key,
            model=resolved.doubao_vision_model,
            timeout_seconds=resolved.ocr_timeout_seconds,
        )

    if provider_name == "mathpix" and resolved.has_mathpix_credentials:
        return MathpixOCRProvider(
            api_url=resolved.mathpix_api_url,
            app_id=resolved.mathpix_app_id,
            app_key=resolved.mathpix_app_key,
            timeout_seconds=resolved.ocr_timeout_seconds,
        )

    if resolved.ocr_mock_fallback:
        return MockOCRProvider()

    raise OCRProviderError("OCR provider is not configured.")


def _build_data_url(image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _extract_openai_compatible_text(body: dict) -> str:
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()
    return ""
