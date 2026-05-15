from fastapi.testclient import TestClient
import fitz
import pytest

from math_agent_api.core.config import get_settings
from math_agent_api.db.session import Base
from math_agent_api.main import app


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


def test_upload_pdf_extracts_chunks_and_lists_document(isolated_database) -> None:
    client = TestClient(app)
    pdf = _build_pdf(
        [
            "Definition. Uniform continuity means one delta works for every point in the domain.",
            "Theorem. Compact intervals turn continuous functions into uniformly continuous functions.",
        ]
    )

    response = client.post(
        "/documents/upload",
        files={"file": ("analysis-notes.pdf", pdf, "application/pdf")},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["document"]["filename"] == "analysis-notes.pdf"
    assert payload["document"]["status"] == "ready"
    assert payload["document"]["page_count"] == 2
    assert payload["document"]["chunk_count"] == 2

    listed = client.get("/documents")

    assert listed.status_code == 200
    assert listed.json()[0]["id"] == payload["document"]["id"]
    assert listed.json()[0]["chunk_count"] == 2


def test_upload_rejects_non_pdf(isolated_database) -> None:
    client = TestClient(app)

    response = client.post(
        "/documents/upload",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "document_validation_error"


def test_duplicate_upload_returns_existing_document(isolated_database) -> None:
    client = TestClient(app)
    pdf = _build_pdf(["Definition. A sequence converges when terms approach a limit."])

    first = client.post(
        "/documents/upload",
        files={"file": ("notes-a.pdf", pdf, "application/pdf")},
    )
    second = client.post(
        "/documents/upload",
        files={"file": ("notes-b.pdf", pdf, "application/pdf")},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["document"]["id"] == first.json()["document"]["id"]
    assert len(client.get("/documents").json()) == 1


def test_delete_document_removes_chunks_from_retrieval(isolated_database) -> None:
    client = TestClient(app)
    pdf = _build_pdf(["Definition. Uniform continuity is stronger than pointwise continuity."])
    uploaded = client.post(
        "/documents/upload",
        files={"file": ("analysis-notes.pdf", pdf, "application/pdf")},
    ).json()["document"]

    before = client.post("/retrieval/search", json={"query": "uniform continuity", "top_k": 5})
    assert before.status_code == 200
    assert before.json()["results"]

    delete_response = client.delete(f"/documents/{uploaded['id']}")
    assert delete_response.status_code == 204

    after = client.post("/retrieval/search", json={"query": "uniform continuity", "top_k": 5})
    assert after.status_code == 200
    assert after.json()["results"] == []


def test_delete_unknown_document_returns_404(isolated_database) -> None:
    client = TestClient(app)

    response = client.delete("/documents/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "document_not_found"


def _build_pdf(pages: list[str]) -> bytes:
    document = fitz.open()
    for text in pages:
        page = document.new_page()
        page.insert_text((72, 72), text, fontsize=12)
    return document.tobytes()
