import json
from collections.abc import AsyncIterator, Sequence

from fastapi.testclient import TestClient
import fitz
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.db.session import Base
from math_agent_api.main import app
from math_agent_api.providers.llm import LLMProviderError
from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import QuestionType
from math_agent_api.services.chat_service import stream_chat_with_provider
from math_agent_api.services.document_service import ingest_pdf_document


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
    metadata = _first_event_data(body, "metadata")
    assert metadata["question_type"] == "computational"
    assert metadata["should_visualize"] is False
    assert metadata["planner"]["question_type"] == metadata["question_type"]
    assert metadata["planner"]["needs_plot"] == metadata["should_visualize"]
    assert metadata["planner"]["needs_retrieval"] is False


@pytest.fixture()
def isolated_database(monkeypatch: pytest.MonkeyPatch, tmp_path):
    from math_agent_api.db import session as db_session

    database_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path}")
    get_settings.cache_clear()

    db_session.engine.dispose()
    db_session.engine = db_session._create_engine()
    db_session.SessionLocal.configure(bind=db_session.engine)
    Base.metadata.create_all(bind=db_session.engine)

    yield db_session

    db_session.engine.dispose()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_chat_stream_returns_retrieved_sources_when_material_matches(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        ingest_pdf_document(
            db=db,
            content=_build_pdf(["Definition. Uniform continuity means one delta controls all x."]),
            filename="analysis-notes.pdf",
            content_type="application/pdf",
        )
        events = [
            event
            async for event in stream_chat_with_provider(
                request=ChatStreamRequest(
                    message="根据课本说明 uniform continuity definition",
                    answer_mode="direct",
                ),
                session_id="session-rag",
                question_type=QuestionType.CONCEPTUAL,
                provider=FakeProvider(),
                db=db,
            )
        ]

    body = "".join(events)
    metadata = _first_event_data(body, "metadata")

    assert metadata["planner"]["needs_retrieval"] is True
    assert metadata["retrieval_attempted"] is True
    assert metadata["retrieved_sources"][0]["filename"] == "analysis-notes.pdf"
    assert metadata["citations"][0]["chunk_id"] == metadata["retrieved_sources"][0]["chunk_id"]


@pytest.mark.asyncio
async def test_chat_stream_probes_uploaded_material_for_course_topic(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        ingest_pdf_document(
            db=db,
            content=_build_pdf(
                [
                    "Composite function derivative rule. Chain rule for multivariable functions.",
                    "The chain rule explains how derivatives pass through intermediate variables.",
                ]
            ),
            filename="chain-rule-notes.pdf",
            content_type="application/pdf",
        )
        events = [
            event
            async for event in stream_chat_with_provider(
                request=ChatStreamRequest(
                    message="explain the chain rule definition",
                    answer_mode="guided",
                ),
                session_id="session-course-topic-rag",
                provider=FakeProvider(),
                db=db,
            )
        ]

    metadata = _first_event_data("".join(events), "metadata")

    assert metadata["retrieval_attempted"] is True
    assert metadata["retrieved_sources"]
    assert metadata["citations"][0]["filename"] == "chain-rule-notes.pdf"


@pytest.mark.asyncio
async def test_chat_stream_does_not_fabricate_sources_when_retrieval_is_empty(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        events = [
            event
            async for event in stream_chat_with_provider(
                request=ChatStreamRequest(
                    message="根据课本说明 uniform continuity definition",
                    answer_mode="direct",
                ),
                session_id="session-empty-rag",
                question_type=QuestionType.CONCEPTUAL,
                provider=FakeProvider(),
                db=db,
            )
        ]

    metadata = _first_event_data("".join(events), "metadata")

    assert metadata["planner"]["needs_retrieval"] is True
    assert metadata["retrieval_attempted"] is True
    assert metadata["retrieved_sources"] == []
    assert metadata["citations"] == []


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
    metadata = _first_event_data(body, "metadata")
    assert metadata["planner"]["needs_plot"] is True
    assert metadata["planner"]["plot_type"] == "surface3d"
    assert metadata["planner"]["plot_suggestion"] == metadata["plot_suggestion"]


def test_chat_stream_suggests_region_plot_for_simple_region_question() -> None:
    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "积分区域 D: 0<=x<=1, 0<=y<=x，帮我画一下区域", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"question_type": "visualization"' in body
    assert '"should_visualize": true' in body
    assert '"plot_type": "region2d"' in body
    assert '"expression": "0<=x<=1, 0<=y<=x' in body


def test_chat_stream_suggests_implicit3d_for_supported_implicit_surface() -> None:
    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "画出 x^4 + y^4 + z^4 = 1 的精确三维隐式曲面", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"question_type": "visualization"' in body
    assert '"should_visualize": true' in body
    assert '"plot_type": "implicit3d"' in body
    assert '"expression": "x^4 + y^4 + z^4 = 1"' in body


def test_chat_stream_suggests_surface_for_upper_hemisphere_request() -> None:
    client = TestClient(app)

    with client.stream(
        "POST",
        "/chat/stream",
        json={"message": "请顺便帮我画出上半球面的三维空间图", "answer_mode": "direct"},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert '"question_type": "visualization"' in body
    assert '"should_visualize": true' in body
    assert '"plot_type": "surface3d"' in body
    assert '"expression": "sqrt(a^2 - x^2 - y^2)"' in body


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
    assert "\\lim" in body
    assert "mock fallback" not in body
    assert "真实 LLM 尚未配置" not in body
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
    assert '"planner": {' in body
    assert '"provider": "unconfigured"' in body
    assert '"finish_reason": "error"' in body


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
    assert '"finish_reason": "stop"' in body


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
    assert '"finish_reason": "error"' in body


def _first_event_data(body: str, event_name: str) -> dict:
    event_marker = f"event: {event_name}"
    for block in body.split("\n\n"):
        if event_marker not in block:
            continue
        for line in block.splitlines():
            if line.startswith("data:"):
                return json.loads(line.removeprefix("data:").strip())
    raise AssertionError(f"event {event_name} not found")


def _build_pdf(pages: list[str]) -> bytes:
    document = fitz.open()
    for text in pages:
        page = document.new_page()
        page.insert_text((72, 72), text, fontsize=12)
    return document.tobytes()
