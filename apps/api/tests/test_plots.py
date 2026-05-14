from fastapi.testclient import TestClient

from math_agent_api.main import app


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
