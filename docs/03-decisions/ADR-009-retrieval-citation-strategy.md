# ADR-009: Retrieval Citation Strategy

Status: proposed

## Context

ADR-007 accepts the Agentic RAG Prototype direction: Math Agent should become a chat-first course assistant that can retrieve from uploaded course materials, cite real sources, and avoid fabricated document metadata. ADR-008 keeps the implementation as a planner-driven explicit service pipeline rather than introducing LangGraph or a heavier orchestration runtime.

The current API contract already allows planner metadata on `POST /chat/stream`, and it notes that `needs_retrieval=true` does not mean sources are currently available. The next implementation stage needs a concrete local-first strategy for PDF ingestion, retrieval, prompt injection, and citation safety before code is added.

This ADR covers the v1 strategy only. It is not a decision to build a full RAG platform, multi-user document system, cloud sync, professional annotation workflow, or complete personal knowledge base.

## Decision

### PDF parsing dependency

Use a backend document parser provider boundary and make **PyMuPDF (`pymupdf`)** the preferred v1 PDF text extraction dependency.

Rationale:

- It extracts text page-by-page, which is required for citation metadata.
- It is practical for local demo PDFs without introducing a hosted parsing service.
- It can preserve enough block/order information for later chunking improvements.
- It keeps OCR for scanned PDFs out of v1 unless a later ADR expands document OCR.

The parser provider must return structured page records, not a single flattened string:

```text
ParsedPage
  page_number
  text
  warnings
```

If a PDF page has no extractable text, ingestion should store a warning/status rather than inventing text through OCR. Scanned-PDF OCR is a future capability and should reuse OCR provider boundaries if added later.

### SQLite document and chunk schema direction

Use local SQLite for v1 document and chunk metadata. The schema should be small, explicit, and page-aware.

Minimum `documents` direction:

```text
documents
  id
  filename
  content_type
  file_hash
  status
  page_count
  created_at
  updated_at
  error_message
```

Minimum `document_chunks` direction:

```text
document_chunks
  id
  document_id
  chunk_index
  page_start
  page_end
  section_title
  text
  text_hash
  token_estimate
  summary
  retrieval_text
  created_at
```

Optional later fields:

```text
  embedding_model
  embedding_ref
  score_debug
```

Schema rules:

- `filename`, `page_start`, `page_end`, `section_title`, and `chunk_index` are the only allowed source metadata for citations.
- `section_title` may be null when extraction cannot identify a heading.
- `summary` may support source display, but citations must be anchored to the original chunk text and page metadata.
- Deleting a document should remove its chunks and make old citations non-reusable unless answer history stores a citation snapshot.

### Chunking strategy

Chunk v1 should prioritize traceable page ranges over semantic cleverness.

The ingestion service should:

- Split by page first.
- Within each page, prefer heading/paragraph blocks when reliable.
- Fall back to bounded text windows with overlap.
- Preserve page range and chunk index for every chunk.
- Keep chunks small enough for prompt injection but large enough to preserve theorem/definition context.

No answer may cite a section title, theorem name, or page number that did not come from stored chunk metadata.

### Retrieval v1

Retrieval v1 should optimize for a reliable local demo, deterministic tests, and no fake citations.

Use a local lexical retrieval baseline first:

- Normalize query and chunk text.
- Use SQLite FTS5 when available, or a repository-level fallback keyword scorer when not.
- Return top-k chunks with explicit scores and source metadata.
- Return an empty result set when no chunk passes a minimum relevance threshold.

Do not require a vector database for v1. Embeddings may be added later behind an `embedding` or `retrieval` provider boundary, but the first accepted path should work without remote embedding calls.

Hybrid retrieval is allowed later if it remains local-first and citation-safe:

```text
query
-> lexical candidate search
-> optional embedding rerank/provider
-> top-k source chunks
```

Retrieval failures must not block ordinary chat. If retrieval is unavailable or empty, chat should continue with a clear "no uploaded material support found" state and no citations.

### Chat pipeline integration

The planner remains the trigger for retrieval intent, but retrieved chunks are the only source of citation metadata.

Recommended pipeline:

```text
POST /chat/stream
-> normalize request and load session context
-> planner emits structured plan
-> if plan.needs_retrieval, call retrieval_service.search(...)
-> build bounded retrieved context block from returned chunks
-> compose answer prompt with citation instructions
-> stream answer
-> emit metadata with retrieved_sources/citations when real chunks exist
-> persist session messages and optional retrieval event
```

Prompt injection shape should separate evidence from instructions:

```text
Retrieved course material:
[chunk_id=..., source_index=1, filename=..., pages=..., section=...]
<chunk text>
```

The LLM may reason beyond retrieved material, but any source claim must be tied to a returned chunk. If the answer uses general math reasoning without retrieved support, it should not attach a citation.

### Citation safety

Citation safety is a hard requirement.

The backend, not the model alone, should own citation validation:

- Citation candidates must map to chunk ids returned by the retrieval service for the current turn.
- Filename, page range, and section title must be copied from stored chunk metadata.
- The answer should never cite a document merely because planner said retrieval was needed.
- Empty retrieval must produce no citations.
- If generated text mentions a citation marker that cannot be validated, the backend should either omit the citation metadata or mark the answer as unsupported rather than fabricating a source.

Citation metadata returned to the frontend should be structured and source-first, for example:

```json
{
  "retrieved_sources": [
    {
      "source_index": 1,
      "chunk_id": "chunk-...",
      "document_id": "doc-...",
      "filename": "Mathematical Analysis Notes.pdf",
      "page_start": 42,
      "page_end": 43,
      "section_title": "Limit Definition",
      "snippet": "..."
    }
  ]
}
```

The frontend may render citations under the assistant answer, but it should not synthesize filename/page/section values from natural-language answer text.

### Automatic tool execution boundary

Planner-driven automatic retrieval is allowed for v1 when:

- The planner says `needs_retrieval=true`.
- Uploaded/indexed material exists.
- User preferences or future settings have not disabled automatic retrieval.

Automatic retrieval does not mean automatic trust. The chat service must distinguish:

- `needs_retrieval=true`: the planner wanted course context.
- `retrieval_attempted=true`: the retrieval service was called.
- `retrieved_sources=[]`: no usable evidence was found.
- `citations=[]`: no validated citations are available.

Document upload, deletion, and reindexing should remain explicit user actions. v1 should not silently crawl local folders, fetch external course material, or index unrelated user files.

## Consequences

- A new backend dependency on `pymupdf` is justified for PDF parsing when implementation begins, but it must be added through the backend requirements and service/provider boundary rather than directly in route handlers.
- SQLite remains the v1 persistence layer; no vector database, cloud storage, account system, or migration framework is required by this ADR.
- API contracts should be updated before implementation to define document endpoints and chat metadata for `retrieved_sources` or citations.
- Existing top-level chat metadata fields must remain compatible; retrieval/citation metadata should be additive.
- Retrieval v1 can be tested locally and deterministically without live LLM, OCR, or embedding providers.
- The system must prefer no citation over an unverifiable citation.

## Testing and Eval Acceptance

Before retrieval/citation work is considered done, add tests or evals covering:

- PDF ingestion stores documents, chunks, page ranges, status, and warnings for pages with no extractable text.
- Re-ingesting the same file can be handled deterministically by file hash or a documented duplicate policy.
- Retrieval returns relevant chunks with filename, page range, chunk id, and snippet.
- Empty or low-confidence retrieval returns an empty source list and does not fabricate document names or pages.
- Chat metadata distinguishes planner intent from actual retrieval results.
- Citation metadata only references chunks returned for that turn.
- A generated answer with no retrieved support contains no citation metadata.
- Retrieval service failure does not break the SSE chat stream.
- Deterministic evals include at least one citation-safe success case and one missing-source/no-fabrication case.

Manual UI acceptance, when frontend citation rendering is added:

- Sources are displayed under the related assistant answer.
- Source labels come from backend metadata.
- The UI remains chat-first and does not become a manual document workbench.
