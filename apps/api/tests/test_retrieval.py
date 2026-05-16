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


def test_retrieval_returns_source_metadata_for_relevant_chunk(isolated_database) -> None:
    client = TestClient(app)
    _upload_pdf(
        client,
        "analysis-notes.pdf",
        [
            "Definition. Uniform continuity means one delta controls all points in the domain.",
            "Sequences and subsequences are discussed in this chapter.",
        ],
    )

    response = client.post("/retrieval/search", json={"query": "uniform continuity delta", "top_k": 5})
    payload = response.json()

    assert response.status_code == 200
    assert payload["query"] == "uniform continuity delta"
    assert payload["results"]
    first = payload["results"][0]
    assert first["filename"] == "analysis-notes.pdf"
    assert first["page_start"] == 1
    assert first["page_end"] == 1
    assert first["chunk_id"].startswith("chunk-")
    assert "Uniform continuity" in first["snippet"]


def test_retrieval_returns_empty_for_low_relevance_query(isolated_database) -> None:
    client = TestClient(app)
    _upload_pdf(client, "analysis-notes.pdf", ["Definition. Uniform continuity uses epsilon and delta."])

    response = client.post("/retrieval/search", json={"query": "basketball cinema", "top_k": 5})

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_retrieval_is_empty_when_no_documents_exist(isolated_database) -> None:
    client = TestClient(app)

    response = client.post("/retrieval/search", json={"query": "uniform continuity", "top_k": 5})

    assert response.status_code == 200
    assert response.json()["results"] == []


def test_retrieval_ranking_prefers_higher_overlap(isolated_database) -> None:
    client = TestClient(app)
    _upload_pdf(
        client,
        "analysis-notes.pdf",
        [
            "This page mentions continuity once.",
            "Uniform continuity and continuity both use epsilon delta definitions for continuity.",
        ],
    )

    response = client.post("/retrieval/search", json={"query": "uniform continuity epsilon delta", "top_k": 2})
    results = response.json()["results"]

    assert response.status_code == 200
    assert results[0]["page_start"] == 2


def test_material_overview_query_returns_real_uploaded_source(isolated_database) -> None:
    client = TestClient(app)
    _upload_pdf(
        client,
        "analysis-notes.pdf",
        ["Definition. Uniform continuity means one delta controls all points in the domain."],
    )

    response = client.post("/retrieval/search", json={"query": "你能看到我上传的PDF吗", "top_k": 5})
    results = response.json()["results"]

    assert response.status_code == 200
    assert results
    assert results[0]["filename"] == "analysis-notes.pdf"
    assert results[0]["page_start"] == 1


def _upload_pdf(client: TestClient, filename: str, pages: list[str]) -> None:
    response = client.post(
        "/documents/upload",
        files={"file": (filename, _build_pdf(pages), "application/pdf")},
    )
    assert response.status_code == 200


def _build_pdf(pages: list[str]) -> bytes:
    document = fitz.open()
    for text in pages:
        page = document.new_page()
        page.insert_text((72, 72), text, fontsize=12)
    return document.tobytes()
