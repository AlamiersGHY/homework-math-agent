from collections.abc import AsyncIterator, Sequence

from fastapi.testclient import TestClient
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.db.session import Base
from math_agent_api.main import app
from math_agent_api.providers.llm import LLMProvider
from math_agent_api.schemas.chat import ChatStreamRequest
from math_agent_api.schemas.common import QuestionType
from math_agent_api.services.chat_service import stream_chat_with_provider


class ShortProvider:
    name = "short"

    async def stream_chat(self, messages: Sequence[dict[str, str]]) -> AsyncIterator[str]:
        yield "持久化回答"


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


def test_sessions_list_starts_empty(isolated_database) -> None:
    client = TestClient(app)

    response = client.get("/sessions")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_chat_stream_persists_session_messages(isolated_database) -> None:
    request = ChatStreamRequest(message="求 lim(x->0) sin(x)/x", answer_mode="direct")

    with isolated_database.SessionLocal() as db:
        events = [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-test",
                question_type=QuestionType.COMPUTATIONAL,
                provider=ShortProvider(),
                db=db,
            )
        ]

    assert 'data: {"finish_reason": "stop"}' in "".join(events)

    client = TestClient(app)
    response = client.get("/sessions/session-test")
    payload = response.json()

    assert response.status_code == 200
    assert payload["session"]["id"] == "session-test"
    assert payload["session"]["title"] == "求 lim(x->0) sin(x)/x"
    assert [message["role"] for message in payload["messages"]] == ["user", "assistant"]
    assert payload["messages"][0]["content"] == "求 lim(x->0) sin(x)/x"
    assert payload["messages"][1]["content"] == "持久化回答"


def test_unknown_session_returns_404(isolated_database) -> None:
    client = TestClient(app)

    response = client.get("/sessions/missing")

    assert response.status_code == 404
