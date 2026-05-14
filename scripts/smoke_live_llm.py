from __future__ import annotations

import os
import tempfile
from pathlib import Path


def assert_ok(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def configure_live_smoke_environment() -> Path:
    database_file = Path(tempfile.gettempdir()) / "math_agent_live_llm_smoke.db"
    database_file.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{database_file}"
    os.environ["LLM_MOCK_FALLBACK"] = "false"
    os.environ["OCR_PROVIDER"] = "mock"
    return database_file


def main() -> int:
    database_file = configure_live_smoke_environment()
    try:
        from fastapi.testclient import TestClient

        from math_agent_api.core.config import get_settings
        from math_agent_api.main import app

        settings = get_settings()
        assert_ok(
            settings.llm_provider.strip().lower() == "openai_compatible",
            "LLM_PROVIDER must be openai_compatible for live LLM smoke.",
        )
        assert_ok(settings.has_llm_credentials, "LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY are required.")

        with TestClient(app) as client:
            with client.stream(
                "POST",
                "/chat/stream",
                json={
                    "message": "Answer directly: compute lim(x->0) sin(x)/x.",
                    "answer_mode": "direct",
                },
            ) as response:
                body = response.read().decode("utf-8")

        assert_ok(response.status_code == 200, "POST /chat/stream failed")
        assert_ok("event: start" in body, "live stream missing start event")
        assert_ok("event: metadata" in body, "live stream missing metadata event")
        assert_ok("event: delta" in body, "live stream missing delta event")
        assert_ok("event: done" in body, "live stream missing done event")
        assert_ok("event: error" not in body, "live stream emitted an error event")
        assert_ok("data:" in body and len(body) > 160, "live stream response was unexpectedly short")

        print("Live LLM smoke passed: SSE start/metadata/delta/done with no error event.")
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
            print(f"Warning: could not delete temporary live smoke database yet: {database_file}")


if __name__ == "__main__":
    raise SystemExit(main())
