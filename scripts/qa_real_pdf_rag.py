from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a user-level PDF RAG QA flow.")
    parser.add_argument("--pdf", required=True, help="Path to a local PDF fixture.")
    parser.add_argument(
        "--query",
        default="解释一下复合函数求导法则",
        help="Question to ask after uploading the PDF.",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    assert_ok(pdf_path.exists(), f"PDF does not exist: {pdf_path}")

    database_file = Path(tempfile.gettempdir()) / "math_agent_real_pdf_rag_qa.db"
    database_file.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = f"sqlite:///{database_file}"
    os.environ["LLM_PROVIDER"] = "mock"
    os.environ["OCR_PROVIDER"] = "mock"
    os.environ["LLM_MOCK_FALLBACK"] = "true"
    os.environ["OCR_MOCK_FALLBACK"] = "true"

    try:
        from fastapi.testclient import TestClient

        from math_agent_api.main import app

        with TestClient(app) as client:
            upload_response = client.post(
                "/documents/upload",
                files={"file": (pdf_path.name, pdf_path.read_bytes(), "application/pdf")},
            )
            assert_ok(upload_response.status_code == 200, "PDF upload failed")
            document = upload_response.json()["document"]
            assert_ok(document["status"] == "ready", f"PDF was not ready: {document}")
            assert_ok(document["page_count"] >= 1, "PDF page count was not recorded")
            assert_ok(document["chunk_count"] >= 1, "PDF produced no retrieval chunks")

            documents_response = client.get("/documents")
            assert_ok(documents_response.status_code == 200, "GET /documents failed")
            documents = documents_response.json()
            assert_ok(len(documents) == 1, "Uploaded PDF was not listed")
            assert_ok(documents[0]["filename"] == pdf_path.name, "Listed filename mismatch")

            retrieval_response = client.post(
                "/retrieval/search",
                json={"query": args.query, "top_k": 5},
            )
            assert_ok(retrieval_response.status_code == 200, "retrieval/search failed")
            retrieval_results = retrieval_response.json()["results"]
            assert_ok(retrieval_results, "retrieval returned no source chunks")
            assert_ok(
                any(source["filename"] == pdf_path.name for source in retrieval_results),
                "retrieval did not cite the uploaded PDF",
            )

            with client.stream(
                "POST",
                "/chat/stream",
                json={
                    "message": args.query,
                    "answer_mode": "guided",
                    "session_id": "qa-real-pdf-rag",
                },
            ) as chat_response:
                chat_body = chat_response.read().decode("utf-8")

            assert_ok(chat_response.status_code == 200, "chat/stream failed")
            metadata = first_event_data(chat_body, "metadata")
            done = first_event_data(chat_body, "done")
            assert_ok(metadata["retrieval_attempted"] is True, "chat did not attempt retrieval")
            assert_ok(metadata["retrieved_sources"], "chat metadata had no retrieved sources")
            assert_ok(metadata["citations"], "chat metadata had no citations")
            assert_ok(
                metadata["citations"][0]["filename"] == pdf_path.name,
                "chat citation did not reference the uploaded PDF",
            )
            assert_ok(done.get("assistant_message_id"), "chat did not persist assistant message")

            session_response = client.get("/sessions/qa-real-pdf-rag")
            assert_ok(session_response.status_code == 200, "session detail failed")
            session_detail = session_response.json()
            metadata_artifacts = [
                artifact
                for artifact in session_detail["artifacts"]
                if artifact["artifact_type"] == "chat_metadata"
            ]
            assert_ok(metadata_artifacts, "chat metadata was not persisted for history replay")
            assert_ok(
                metadata_artifacts[-1]["payload"]["citations"],
                "persisted metadata had no citations for history replay",
            )

        print(
            json.dumps(
                {
                    "status": "passed",
                    "pdf": str(pdf_path),
                    "page_count": document["page_count"],
                    "chunk_count": document["chunk_count"],
                    "top_source": metadata["citations"][0],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
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
            print(f"Warning: could not delete temporary QA database yet: {database_file}")


def first_event_data(body: str, event_name: str) -> dict:
    marker = f"event: {event_name}"
    for block in body.split("\n\n"):
        if marker not in block:
            continue
        for line in block.splitlines():
            if line.startswith("data:"):
                return json.loads(line.removeprefix("data:").strip())
    raise AssertionError(f"missing SSE event: {event_name}")


def assert_ok(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    raise SystemExit(main())
