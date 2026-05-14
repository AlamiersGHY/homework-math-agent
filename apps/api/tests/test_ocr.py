from fastapi.testclient import TestClient
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.main import app
from math_agent_api.providers.ocr import (
    DoubaoVisionOCRProvider,
    MockOCRProvider,
    get_ocr_provider,
)


@pytest.fixture(autouse=True)
def force_mock_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OCR_PROVIDER", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_ocr_recognize_returns_editable_text() -> None:
    client = TestClient(app)

    response = client.post(
        "/ocr/recognize",
        files={"file": ("problem.png", b"fake-image-bytes", "image/png")},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["provider"] == "mock"
    assert "\\lim" in payload["recognized_text"]
    assert payload["warnings"]


def test_ocr_rejects_unsupported_file_type() -> None:
    client = TestClient(app)

    response = client.post(
        "/ocr/recognize",
        files={"file": ("problem.txt", b"not-an-image", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "ocr_validation_error"


def test_ocr_falls_back_to_mock_without_doubao_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OCR_PROVIDER", "doubao_vision")
    monkeypatch.setenv("DOUBAO_API_KEY", "")
    monkeypatch.setenv("DOUBAO_VISION_MODEL", "")
    monkeypatch.setenv("OCR_MOCK_FALLBACK", "true")
    get_settings.cache_clear()

    provider = get_ocr_provider()

    assert isinstance(provider, MockOCRProvider)


def test_ocr_uses_doubao_provider_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OCR_PROVIDER", "doubao_vision")
    monkeypatch.setenv("DOUBAO_API_KEY", "test-key")
    monkeypatch.setenv("DOUBAO_VISION_MODEL", "test-model")
    get_settings.cache_clear()

    provider = get_ocr_provider()

    assert isinstance(provider, DoubaoVisionOCRProvider)
    assert provider.model == "test-model"
