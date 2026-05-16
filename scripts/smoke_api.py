from __future__ import annotations

import base64
import json
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

            pdf_bytes = sample_pdf_bytes()
            uploaded = client.post(
                "/documents/upload",
                files={"file": ("analysis-notes.pdf", pdf_bytes, "application/pdf")},
            )
            assert_ok(uploaded.status_code == 200, "POST /documents/upload failed")
            document = uploaded.json()["document"]
            assert_ok(document["status"] == "ready", "uploaded PDF was not ready")
            assert_ok(document["chunk_count"] >= 1, "uploaded PDF did not create chunks")

            documents = client.get("/documents")
            assert_ok(documents.status_code == 200, "GET /documents failed")
            assert_ok(len(documents.json()) == 1, "GET /documents did not list uploaded PDF")

            retrieval = client.post(
                "/retrieval/search",
                json={"query": "uniform continuity delta definition", "top_k": 5},
            )
            assert_ok(retrieval.status_code == 200, "POST /retrieval/search failed")
            retrieval_results = retrieval.json()["results"]
            assert_ok(retrieval_results, "retrieval did not return uploaded source")
            assert_ok(
                retrieval_results[0]["filename"] == "analysis-notes.pdf",
                "retrieval source filename mismatch",
            )

            with client.stream(
                "POST",
                "/chat/stream",
                json={
                    "message": "explain uniform continuity definition",
                    "answer_mode": "direct",
                },
            ) as response:
                rag_body = response.read().decode("utf-8")
            assert_ok(response.status_code == 200, "RAG chat stream failed")
            rag_metadata = first_event_data(rag_body, "metadata")
            assert_ok(rag_metadata["retrieval_attempted"] is True, "chat did not attempt retrieval")
            assert_ok(rag_metadata["citations"], "chat metadata did not include citations")
            assert_ok(
                rag_metadata["citations"][0]["filename"] == "analysis-notes.pdf",
                "chat citation filename mismatch",
            )

            delete_document = client.delete(f"/documents/{document['id']}")
            assert_ok(delete_document.status_code == 204, "DELETE /documents/{id} failed")
            empty_retrieval = client.post(
                "/retrieval/search",
                json={"query": "uniform continuity delta definition", "top_k": 5},
            )
            assert_ok(empty_retrieval.status_code == 200, "empty retrieval request failed")
            assert_ok(empty_retrieval.json()["results"] == [], "deleted document still appeared in retrieval")

        print("API smoke passed: health, chat SSE, OCR mock, plot previews, sessions, PDF RAG.")
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


def first_event_data(body: str, event_name: str) -> dict:
    marker = f"event: {event_name}"
    for block in body.split("\n\n"):
        if marker not in block:
            continue
        for line in block.splitlines():
            if line.startswith("data:"):
                return json.loads(line.removeprefix("data:").strip())
    raise AssertionError(f"missing SSE event: {event_name}")


def sample_pdf_bytes() -> bytes:
    return base64.b64decode(
        "JVBERi0xLjcKJcK1wrYKJSBXcml0dGVuIGJ5IE11UERGIDEuMjcuMgoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvSW5mbzw8L1Byb2R1Y2VyKE11UERGIDEuMjcuMik+Pj4+CmVuZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1s0IDAgUl0+PgplbmRvYmoKCjMgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1JvdGF0ZSAwL1Jlc291cmNlcyAzIDAgUi9QYXJlbnQgMiAwIFIvQ29udGVudHNbNiAwIFJdPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+PgplbmRvYmoKCjYgMCBvYmoKPDwvTGVuZ3RoIDE3NC9GaWx0ZXIvRmxhdGVEZWNvZGU+PgpzdHJlYW0KeNqNj7EOAiEQRHu+gj8QFtiRxFiY2NiZ0BmrO4iFFjZ+/82el9gaiiVvZh/Bvd2puegDT/QQDwTfXm736M+Pj+Lb8LdDzlpUtWrXisw5tEuXUIoRJgOiswRNlqyNjmJdVNKZ25Ek8c5cC6cZJzbjb4uOQWatqJNOEmD9umZGeSPLut8Mg+a4UvJslhm2m5C/bXYLBGo+MyDwjYK0UVrwzw/68d4u7tzc1S0uuUbhCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA0MiAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4gCjAwMDAwMDAxNzIgMDAwMDAgbiAKMDAwMDAwMDIxMyAwMDAwMCBuIAowMDAwMDAwMzIwIDAwMDAwIG4gCjAwMDAwMDA0MDkgMDAwMDAgbiAKCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFIvSURbPEMzQjlDM0FGMERDMzk4MEIxMUMyOUM2NUMyQTVDMzgzPjxDRTcwOEIxQzREOTgxQ0Y0RTU0QzdEQkJCRUU4REU3NT5dPj4Kc3RhcnR4cmVmCjY1MgolJUVPRgo="
    )


if __name__ == "__main__":
    raise SystemExit(main())
