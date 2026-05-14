from fastapi.testclient import TestClient

from math_agent_api.main import app


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
