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
from math_agent_api.services.session_service import append_artifact, append_message, ensure_session


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

    assert '"finish_reason": "stop"' in "".join(events)

    client = TestClient(app)
    response = client.get("/sessions/session-test")
    payload = response.json()

    assert response.status_code == 200
    assert payload["session"]["id"] == "session-test"
    assert payload["session"]["title"] == "求 lim(x->0) sin(x)/x"
    assert [message["role"] for message in payload["messages"]] == ["user", "assistant"]
    assert payload["messages"][0]["content"] == "求 lim(x->0) sin(x)/x"
    assert payload["messages"][1]["content"] == "持久化回答"


@pytest.mark.asyncio
async def test_chat_stream_persists_image_attachment_snapshot_without_ocr_leak(
    isolated_database,
) -> None:
    request = ChatStreamRequest(
        message="Please solve the problem in this image",
        answer_mode="direct",
        confirmed_ocr_text="[qa-attachment-a.png]\nSolve lim_{x\\to0} sin(x)/x",
        attachments=[
            {
                "id": "image-test",
                "kind": "image",
                "file_name": "qa-attachment-a.png",
                "preview_data_url": "data:image/png;base64,abc",
                "annotated": True,
            }
        ],
    )

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-image-history",
                question_type=QuestionType.OCR_DERIVED,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    response = client.get("/sessions/session-image-history")
    payload = response.json()
    user_message = next(message for message in payload["messages"] if message["role"] == "user")
    attachment_artifact = next(
        artifact
        for artifact in payload["artifacts"]
        if artifact["artifact_type"] == "message_attachments"
    )

    assert response.status_code == 200
    assert user_message["content"] == "Please solve the problem in this image"
    assert "lim_" not in user_message["content"]
    assert attachment_artifact["message_id"] == user_message["id"]
    assert attachment_artifact["payload"]["attachments"][0] == {
        "id": "image-test",
        "kind": "image",
        "file_name": "qa-attachment-a.png",
        "preview_data_url": "data:image/png;base64,abc",
        "annotated": True,
    }


@pytest.mark.asyncio
async def test_chat_stream_persists_plot_suggestion_artifact(isolated_database) -> None:
    request = ChatStreamRequest(message="画一下 z = sin(x*y) 的三维曲面", answer_mode="direct")

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-visual",
                question_type=QuestionType.VISUALIZATION,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    response = client.get("/sessions/session-visual")
    payload = response.json()
    assistant_message = next(message for message in payload["messages"] if message["role"] == "assistant")
    artifacts = payload["artifacts"]

    assert response.status_code == 200
    assert any(
        artifact["artifact_type"] == "chat_metadata"
        and artifact["message_id"] == assistant_message["id"]
        and artifact["payload"]["planner"]["needs_plot"] is True
        for artifact in artifacts
    )
    chat_metadata = next(artifact for artifact in artifacts if artifact["artifact_type"] == "chat_metadata")
    assert chat_metadata["payload"]["quick_replies"] == []
    assert any(
        artifact["artifact_type"] == "plot_suggestion"
        and artifact["message_id"] == assistant_message["id"]
        and artifact["payload"]["plot_suggestion"]["plot_type"] == "surface3d"
        for artifact in artifacts
    )


@pytest.mark.asyncio
async def test_chat_stream_persists_implicit3d_plot_suggestion_artifact(isolated_database) -> None:
    request = ChatStreamRequest(
        message="画出 x^4 + y^4 + z^4 = 1 的精确三维隐式曲面",
        answer_mode="direct",
    )

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-implicit",
                question_type=QuestionType.VISUALIZATION,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    response = client.get("/sessions/session-implicit")
    artifacts = response.json()["artifacts"]

    assert response.status_code == 200
    assert any(
        artifact["artifact_type"] == "plot_suggestion"
        and artifact["payload"]["plot_suggestion"]["plot_type"] == "implicit3d"
        and artifact["payload"]["plot_suggestion"]["expression"] == "x^4 + y^4 + z^4 = 1"
        for artifact in artifacts
    )


@pytest.mark.asyncio
async def test_chat_stream_persists_guided_quick_replies(isolated_database) -> None:
    request = ChatStreamRequest(
        message="姹?lim(x->0) sin(x)/x",
        answer_mode="guided",
        context={"style": "custom", "soul": "先讲直觉，再指出易错点。"},
    )

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-guided-metadata",
                question_type=QuestionType.COMPUTATIONAL,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    response = client.get("/sessions/session-guided-metadata")
    artifacts = response.json()["artifacts"]

    assert response.status_code == 200
    chat_metadata = next(artifact for artifact in artifacts if artifact["artifact_type"] == "chat_metadata")
    assert chat_metadata["payload"]["quick_replies"] == [
        "第一步为什么要想到标准极限？",
        "能用夹逼定理引导我吗？",
        "如果换成 sin(3x)/x 怎么办？",
    ]
    assert chat_metadata["payload"]["style_config"] == {
        "style": "custom",
        "soul": "先讲直觉，再指出易错点。",
    }


@pytest.mark.asyncio
async def test_chat_stream_persists_empty_quick_replies_for_direct_mode(isolated_database) -> None:
    request = ChatStreamRequest(message="姹?lim(x->0) sin(x)/x", answer_mode="direct")

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-direct-metadata",
                question_type=QuestionType.COMPUTATIONAL,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    response = client.get("/sessions/session-direct-metadata")
    artifacts = response.json()["artifacts"]

    assert response.status_code == 200
    chat_metadata = next(artifact for artifact in artifacts if artifact["artifact_type"] == "chat_metadata")
    assert chat_metadata["payload"]["quick_replies"] == []


def test_unknown_session_returns_404(isolated_database) -> None:
    client = TestClient(app)

    response = client.get("/sessions/missing")

    assert response.status_code == 404


def test_session_detail_returns_all_messages_and_ordered_artifacts(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        ensure_session(db, "session-long", default_answer_mode="guided")
        for index in range(60):
            append_message(
                db,
                session_id="session-long",
                role="user" if index % 2 == 0 else "assistant",
                content=f"message {index:02d}",
                answer_mode="guided",
            )
        append_artifact(
            db,
            session_id="session-long",
            artifact_type="plot_suggestion",
            payload={"plot_suggestion": {"expression": "sin(x)"}},
            message_id=None,
        )
        append_artifact(
            db,
            session_id="session-long",
            artifact_type="plot_preview",
            payload={"plot": {"plot_type": "function2d"}},
            message_id=None,
        )

    client = TestClient(app)
    response = client.get("/sessions/session-long")
    payload = response.json()

    assert response.status_code == 200
    assert len(payload["messages"]) == 60
    assert payload["messages"][0]["content"] == "message 00"
    assert payload["messages"][-1]["content"] == "message 59"
    assert [artifact["artifact_type"] for artifact in payload["artifacts"]] == [
        "plot_suggestion",
        "plot_preview",
    ]


@pytest.mark.asyncio
async def test_delete_session_removes_session_messages_and_artifacts(isolated_database) -> None:
    request = ChatStreamRequest(message="画一下 z = sin(x*y) 的三维曲面", answer_mode="direct")

    with isolated_database.SessionLocal() as db:
        [
            event
            async for event in stream_chat_with_provider(
                request=request,
                session_id="session-delete",
                question_type=QuestionType.VISUALIZATION,
                provider=ShortProvider(),
                db=db,
            )
        ]

    client = TestClient(app)
    plot_response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
            "session_id": "session-delete",
        },
    )
    assert plot_response.status_code == 200

    detail_response = client.get("/sessions/session-delete")
    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert len(payload["messages"]) == 2
    assert len(payload["artifacts"]) == 3
    assert {artifact["artifact_type"] for artifact in payload["artifacts"]} == {
        "chat_metadata",
        "plot_suggestion",
        "plot_preview",
    }

    delete_response = client.delete("/sessions/session-delete")
    assert delete_response.status_code == 204

    assert client.get("/sessions/session-delete").status_code == 404


def test_delete_unknown_session_returns_404(isolated_database) -> None:
    client = TestClient(app)

    response = client.delete("/sessions/missing")

    assert response.status_code == 404
