from __future__ import annotations

import os
import tempfile
from pathlib import Path


def configure_mock_environment() -> Path:
    database_file = Path(tempfile.gettempdir()) / "math_agent_release_smoke.db"
    database_file.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{database_file}"
    os.environ["LLM_PROVIDER"] = "mock"
    os.environ["OCR_PROVIDER"] = "mock"
    os.environ["LLM_MOCK_FALLBACK"] = "true"
    os.environ["OCR_MOCK_FALLBACK"] = "true"
    return database_file


def assert_ok(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    database_file = configure_mock_environment()
    try:
        from fastapi.testclient import TestClient

        from math_agent_api.main import app

        with TestClient(app) as client:

            health = client.get("/health")
            assert_ok(health.status_code == 200, "GET /health failed")
            assert_ok(health.json()["status"] == "ok", "GET /health returned unexpected status")

            with client.stream(
                "POST",
                "/chat/stream",
                json={"message": "Plot z = sin(x*y) as a 3D surface.", "answer_mode": "direct"},
            ) as response:
                chat_body = response.read().decode("utf-8")
            assert_ok(response.status_code == 200, "POST /chat/stream failed")
            assert_ok("event: start" in chat_body, "chat stream missing start event")
            assert_ok("event: delta" in chat_body, "chat stream missing delta event")
            assert_ok('"plot_type": "surface3d"' in chat_body, "chat stream missing surface plot suggestion")

            ocr = client.post(
                "/ocr/recognize",
                files={"file": ("problem.png", b"fake-image-bytes", "image/png")},
            )
            assert_ok(ocr.status_code == 200, "POST /ocr/recognize failed")
            assert_ok("recognized_text" in ocr.json(), "OCR response missing recognized_text")

            surface = client.post(
                "/plots/preview",
                json={
                    "plot_type": "surface3d",
                    "expression": "sin(x*y)",
                    "variables": ["x", "y"],
                    "ranges": {"x": [-3, 3], "y": [-3, 3]},
                },
            )
            assert_ok(surface.status_code == 200, "surface3d plot preview failed")
            assert_ok(surface.json()["renderer"] == "plotly", "surface3d preview is not Plotly")

            region = client.post(
                "/plots/preview",
                json={
                    "plot_type": "region2d",
                    "expression": "0<=x<=1, 0<=y<=x",
                    "variables": ["x", "y"],
                    "ranges": {"x": [0, 1], "y": [0, 1]},
                },
            )
            assert_ok(region.status_code == 200, "region2d plot preview failed")
            assert_ok(region.json()["renderer"] == "plotly", "region2d preview is not Plotly")

            sessions = client.get("/sessions")
            assert_ok(sessions.status_code == 200, "GET /sessions failed")
            assert_ok(isinstance(sessions.json(), list), "GET /sessions did not return a list")

        print("API smoke passed: health, chat SSE, OCR mock, plot previews, sessions.")
        return 0
    finally:
        try:
            from math_agent_api.db import session as db_session

            db_session.engine.dispose()
        except Exception:
            pass
        try:
            database_file.unlink(missing_ok=True)
        except PermissionError:
            print(f"Warning: could not delete temporary smoke database yet: {database_file}")


if __name__ == "__main__":
    raise SystemExit(main())
