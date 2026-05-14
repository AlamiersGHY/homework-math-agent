# ADR-002: MVP Architecture

Status: accepted

## Context

The MVP needs to support chat, answer-mode control, OCR input, and 2D/3D visualization while keeping implementation manageable for short-cycle AI Coding.

The product scope explicitly excludes heavy LangGraph orchestration, full RAG, user accounts, and complete personal knowledge-base features for the first version.

## Decision

Use a lightweight architecture:

- Frontend: `apps/web` with Next.js + TypeScript.
- Backend: `apps/api` with FastAPI + Pydantic.
- Chat transport: SSE via `POST /chat/stream`.
- Persistence: SQLite is allowed for lightweight session, message, preference, resource, or debug data.
- Agent orchestration: explicit service pipeline instead of LangGraph.
- External capabilities: LLM, OCR, plot, and retrieval integrations must go through provider/service boundaries.
- Plot output: first version targets Plotly-style plot specs.

## Consequences

- The MVP can deliver a stream-first chat experience without committing to heavy agent infrastructure.
- SQLite can support practical development without requiring the user to manage backend database complexity.
- Provider abstractions keep paid OCR/LLM/plot choices replaceable.
- If workflow branching becomes too complex, LangGraph may be reconsidered through a later ADR.
- API, service, provider, and eval boundaries must be kept explicit during implementation.
