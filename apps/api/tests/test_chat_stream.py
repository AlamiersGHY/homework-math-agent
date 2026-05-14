from collections.abc import AsyncIterator, Sequence

from fastapi.testclient import TestClient
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.main import app
from math_agent_api.providers.llm import LLMProviderError
from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import QuestionType
from math_agent_api.services.chat_service import stream_chat_with_provider


@pytest.fixture(autouse=True)
def force_mock_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_chat_stream_returns_sse_events() -> None:
    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "求 lim(x->0) sin(x)/x", "answer_mode": "guided"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: start" in body
    assert "event: metadata" in body
    assert "event: delta" in body
    assert "event: done" in body
    assert '"question_type": "computational"' in body


def test_chat_stream_includes_plot_suggestion_for_visualization_question() -> None:
    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "画一下 z = sin(x*y) 的三维曲面", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"question_type": "visualization"' in body
    assert '"should_visualize": true' in body
    assert '"plot_type": "surface3d"' in body
    assert '"expression": "sin(x*y)"' in body


def test_chat_stream_falls_back_to_mock_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LLM_BASE_URL", "https://api.deepseek.com")
    monkeypatch.setenv("LLM_MODEL", "deepseek-v4-flash")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("LLM_MOCK_FALLBACK", "true")
    get_settings.cache_clear()

    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "求 lim(x->0) sin(x)/x", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert "真实 LLM 尚未配置" in body
    assert "event: done" in body


def test_chat_stream_returns_sse_error_when_provider_is_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LLM_BASE_URL", "")
    monkeypatch.setenv("LLM_MODEL", "")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("LLM_MOCK_FALLBACK", "false")
    get_settings.cache_clear()

    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "求 lim(x->0) sin(x)/x", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert "event: error" in body
    assert '"provider": "unconfigured"' in body
    assert 'data: {"finish_reason": "error"}' in body


class FakeProvider:
    name = "fake"

    async def stream_chat(self, messages: Sequence[dict[str, str]]) -> AsyncIterator[str]:
        assert messages[-1]["role"] == "user"
        yield "第一段"
        yield "第二段"


@pytest.mark.asyncio
async def test_chat_service_maps_provider_chunks_to_sse_delta_events() -> None:
    request = ChatStreamRequest(message="求 lim(x->0) sin(x)/x", answer_mode="direct")

    events = [
        event
        async for event in stream_chat_with_provider(
            request=request,
            session_id="session-test",
            question_type=QuestionType.COMPUTATIONAL,
            provider=FakeProvider(),
        )
    ]

    body = "".join(events)
    assert "event: start" in body
    assert "event: metadata" in body
    assert 'data: {"text": "第一段"}' in body
    assert 'data: {"text": "第二段"}' in body
    assert 'data: {"finish_reason": "stop"}' in body


class FailingProvider:
    name = "failing"

    async def stream_chat(self, messages: Sequence[dict[str, str]]) -> AsyncIterator[str]:
        raise LLMProviderError("boom")
        yield ""


@pytest.mark.asyncio
async def test_chat_service_maps_provider_failure_to_sse_error_event() -> None:
    request = ChatStreamRequest(message="求 lim(x->0) sin(x)/x", answer_mode="direct")

    events = [
        event
        async for event in stream_chat_with_provider(
            request=request,
            session_id="session-test",
            question_type=QuestionType.COMPUTATIONAL,
            provider=FailingProvider(),
        )
    ]

    body = "".join(events)
    assert "event: error" in body
    assert '"code": "llm_provider_error"' in body
    assert '"provider": "failing"' in body
    assert 'data: {"finish_reason": "error"}' in body
