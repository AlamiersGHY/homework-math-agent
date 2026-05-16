from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def assert_ok(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def configure_live_smoke_environment() -> Path:
    database_file = Path(tempfile.gettempdir()) / "math_agent_live_followups_smoke.db"
    database_file.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{database_file}"
    os.environ["LLM_MOCK_FALLBACK"] = "false"
    os.environ["OCR_PROVIDER"] = "mock"
    return database_file


def parse_sse_events(body: str) -> list[tuple[str, dict[str, Any]]]:
    events: list[tuple[str, dict[str, Any]]] = []
    for block in body.split("\n\n"):
        event_name = ""
        data_lines: list[str] = []
        for line in block.splitlines():
            if line.startswith("event:"):
                event_name = line.removeprefix("event:").strip()
            elif line.startswith("data:"):
                data_lines.append(line.removeprefix("data:").strip())
        if not event_name or not data_lines:
            continue
        events.append((event_name, json.loads("\n".join(data_lines))))
    return events


def main() -> int:
    database_file = configure_live_smoke_environment()
    try:
        from fastapi.testclient import TestClient

        from math_agent_api.core.config import get_settings
        from math_agent_api.main import app

        settings = get_settings()
        assert_ok(
            settings.llm_provider.strip().lower() == "openai_compatible",
            "LLM_PROVIDER must be openai_compatible for live follow-up smoke.",
        )
        assert_ok(settings.has_llm_credentials, "LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY are required.")

        with TestClient(app) as client:
            with client.stream(
                "POST",
                "/chat/stream",
                json={
                    "message": "请直接讲解为什么 lim(x->0) sin(x)/x = 1，并在回答后给出相关追问。",
                    "answer_mode": "direct",
                },
            ) as response:
                body = response.read().decode("utf-8")

        assert_ok(response.status_code == 200, "POST /chat/stream failed")
        events = parse_sse_events(body)
        metadata_events = [data for event, data in events if event == "metadata"]
        assert_ok(len(metadata_events) >= 2, "live stream did not emit follow-up metadata after the answer.")

        first_metadata = metadata_events[0]
        final_metadata = metadata_events[-1]
        quick_replies = final_metadata.get("quick_replies")
        quick_reply_source = final_metadata.get("quick_reply_source")

        assert_ok(first_metadata.get("quick_reply_source") == "pending", "initial metadata did not mark quick replies pending.")
        assert_ok(quick_reply_source == "llm", f"expected LLM quick replies, got {quick_reply_source!r}.")
        assert_ok(isinstance(quick_replies, list), "quick_replies was not a list.")
        assert_ok(len(quick_replies) == 3, f"expected 3 quick replies, got {quick_replies!r}.")
        assert_ok(all(isinstance(item, str) and item.strip() for item in quick_replies), "quick replies must be non-empty strings.")

        print("Live follow-up smoke passed: quick_reply_source=llm")
        for index, reply in enumerate(quick_replies, start=1):
            print(f"{index}. {reply}")
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
            print(f"Warning: could not delete temporary live follow-up smoke database yet: {database_file}")


if __name__ == "__main__":
    raise SystemExit(main())
