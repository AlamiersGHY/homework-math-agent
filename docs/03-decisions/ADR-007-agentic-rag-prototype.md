# ADR-007: Agentic RAG Prototype Direction

Status: accepted

## Context

The local MVP now supports chat, answer modes, OCR input, local sessions, and Plotly-style visualization. The next product direction is a chat-first intelligent course assistant that can decide when to use retrieval, visualization, clarification, preferences, and lightweight memory.

The user explicitly wants capability growth beyond the narrow MVP demo while preserving the SDD workflow, local-first implementation discipline, provider/service boundaries, and verifiable delivery units.

## Decision

The next stage is accepted as the **Agentic RAG Prototype / Intelligent Course Assistant Prototype**.

The implementation remains an explicit service pipeline for now. We will not introduce LangGraph or a heavy multi-agent orchestration framework in this stage. Instead, the backend will add a structured planner service that emits Pydantic-modeled decisions and drives later tools.

The staged direction is:

1. Agent policy planner v1.
2. Local PDF/document ingestion and retrieval v1.
3. Retrieval-augmented answers with citation-safe source display.
4. Automatic tool execution driven by the planner.
5. Preferences and lightweight memory.
6. Course assistant polish.

The prototype may add local SQLite tables for documents, chunks, retrieval events, profile preferences, and bounded memory items. Provider logic must remain behind service/provider boundaries.

## Consequences

- `docs/00-product/scope.md` and `docs/00-product/roadmap.md` now distinguish completed MVP scope from next-stage Agentic RAG scope.
- API contracts may expand with planner metadata, document endpoints, retrieval results, citations, profile settings, and memory metadata.
- Planner, retrieval, citation, preference, and memory behavior must be covered by tests or evals when implemented.
- Retrieval failures must not block ordinary chat answers.
- The product must not fabricate document names, page numbers, or citation metadata.
- The UI should stay chat-first and avoid becoming a manual tool workbench.
- Before Phase 4.2 document ingestion/retrieval implementation, add or update a retrieval/citation strategy ADR covering PDF parsing, chunk metadata, retrieval method, citation safety, and dependency choices.
