from fastapi.testclient import TestClient
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.db.session import Base
from math_agent_api.main import app
from math_agent_api.services.session_service import ensure_session


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


def test_plot_preview_function2d_returns_plotly_spec() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "function2d",
            "expression": "sin(x)/x",
            "variables": ["x"],
            "ranges": {"x": [-6, 6]},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["plot_type"] == "function2d"
    assert payload["renderer"] == "plotly"
    assert payload["spec"]["data"][0]["type"] == "scatter"
    assert len(payload["spec"]["data"][0]["x"]) == 120


def test_plot_preview_surface3d_returns_plotly_surface() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["plot_type"] == "surface3d"
    assert payload["spec"]["data"][0]["type"] == "surface"
    assert len(payload["spec"]["data"][0]["z"]) == 35
    assert len(payload["spec"]["data"][0]["z"][0]) == 35


def test_plot_preview_surface3d_allows_default_radius_parameter_a() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sqrt(a^2 - x^2 - y^2)",
            "variables": ["x", "y"],
            "ranges": {"x": [-1, 1], "y": [-1, 1]},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["plot_type"] == "surface3d"
    assert payload["spec"]["data"][0]["type"] == "surface"
    assert payload["spec"]["data"][0]["z"][17][17] == pytest.approx(1.0)


def test_plot_preview_implicit3d_returns_plotly_isosurface() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "implicit3d",
            "expression": "x^4 + y^4 + z^4 = 1",
            "variables": ["x", "y", "z"],
            "ranges": {"x": [-1.5, 1.5], "y": [-1.5, 1.5], "z": [-1.5, 1.5]},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["plot_type"] == "implicit3d"
    assert payload["renderer"] == "plotly"
    trace = payload["spec"]["data"][0]
    values = trace["value"]
    assert trace["type"] == "isosurface"
    assert trace["isomin"] < 0
    assert trace["isomax"] > 0
    assert trace["isomin"] < trace["isomax"]
    assert len(values) == 35 * 35 * 35
    assert min(value for value in values if value is not None) < 0
    assert max(value for value in values if value is not None) > 0


def test_plot_preview_region2d_returns_plotly_region() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "region2d",
            "expression": "0<=x<=1, 0<=y<=x",
            "variables": ["x", "y"],
            "ranges": {"x": [0, 1], "y": [0, 1]},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["plot_type"] == "region2d"
    assert payload["renderer"] == "plotly"
    assert payload["spec"]["data"][0]["fill"] == "toself"


def test_plot_preview_rejects_unsafe_expression() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "function2d",
            "expression": "__import__('os').system('dir')",
            "variables": ["x"],
            "ranges": {"x": [-1, 1]},
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "plot_validation_error"


def test_plot_preview_rejects_unsupported_region() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "region2d",
            "expression": "x^2 + y^2 <= 1",
            "variables": ["x", "y"],
            "ranges": {"x": [-1, 1], "y": [-1, 1]},
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "plot_validation_error"


def test_plot_preview_rejects_invalid_range() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "x + y",
            "variables": ["x", "y"],
            "ranges": {"x": [2, 2], "y": [-1, 1]},
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "plot_validation_error"


def test_plot_preview_implicit3d_rejects_invalid_variable() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "implicit3d",
            "expression": "x^2 + y^2 + w^2 = 1",
            "variables": ["x", "y", "w"],
            "ranges": {"x": [-1, 1], "y": [-1, 1], "w": [-1, 1]},
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "plot_validation_error"


def test_plot_preview_implicit3d_rejects_unsafe_expression() -> None:
    client = TestClient(app)

    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "implicit3d",
            "expression": "__import__('os').system('dir') + y + z = 1",
            "variables": ["x", "y", "z"],
            "ranges": {"x": [-1, 1], "y": [-1, 1], "z": [-1, 1]},
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "plot_validation_error"


def test_plot_preview_persists_artifact_when_session_is_known(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        ensure_session(db, "session-plot", default_answer_mode="direct")

    client = TestClient(app)
    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
            "session_id": "session-plot",
        },
    )

    assert response.status_code == 200

    detail = client.get("/sessions/session-plot")
    payload = detail.json()

    assert detail.status_code == 200
    assert len(payload["artifacts"]) == 1
    assert payload["artifacts"][0]["artifact_type"] == "plot_preview"
    assert payload["artifacts"][0]["payload"]["plot"]["plot_type"] == "surface3d"


def test_plot_preview_persists_message_id_when_provided(isolated_database) -> None:
    with isolated_database.SessionLocal() as db:
        ensure_session(db, "session-plot-message", default_answer_mode="direct")

    client = TestClient(app)
    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
            "session_id": "session-plot-message",
            "message_id": "assistant-message-opaque",
        },
    )

    assert response.status_code == 200

    detail = client.get("/sessions/session-plot-message")
    artifact = detail.json()["artifacts"][0]

    assert artifact["artifact_type"] == "plot_preview"
    assert artifact["message_id"] == "assistant-message-opaque"


def test_plot_preview_returns_404_when_session_id_is_unknown(isolated_database) -> None:
    client = TestClient(app)
    response = client.post(
        "/plots/preview",
        json={
            "plot_type": "surface3d",
            "expression": "sin(x*y)",
            "variables": ["x", "y"],
            "ranges": {"x": [-3, 3], "y": [-3, 3]},
            "session_id": "missing-session",
        },
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "session_not_found"
