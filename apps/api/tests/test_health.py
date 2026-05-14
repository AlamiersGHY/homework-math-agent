from fastapi.testclient import TestClient

from math_agent_api.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "math-agent-api",
        "version": "0.1.0",
    }
