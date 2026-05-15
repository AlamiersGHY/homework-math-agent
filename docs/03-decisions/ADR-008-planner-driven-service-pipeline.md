# ADR-008: Planner-Driven Explicit Service Pipeline

Status: accepted

## Context

The Agentic RAG Prototype needs an agentic feel: the system should decide whether retrieval, plotting, clarification, answer-mode adjustment, preferences, or memory should be used. However, the project still values a readable, testable service pipeline and does not yet need a heavy graph orchestration framework.

## Decision

Phase 1 will add a Pydantic-modeled planner service to the existing FastAPI backend.

The planner emits structured decisions before answer generation. The minimum plan fields are:

- `question_type`
- `needs_retrieval`
- `needs_plot`
- `needs_clarification`
- `answer_mode`
- `memory_action`
- `reason`

The chat service will include the planner output in SSE metadata and use it as the source of truth for question type, visualization decision, and answer-mode resolution. In Phase 1, planner output does not require full PDF RAG, automatic retrieval execution, or memory writes.

Planner v1 must have deterministic fallback behavior and must be testable without a live LLM provider.

## Consequences

- Planner decisions are internal structured metadata, not a user-facing debug panel.
- Future retrieval, plot, profile, and memory tools should be driven from planner fields rather than ad hoc UI toggles.
- Existing chat/OCR/plot/session behavior must continue to work while planner metadata expands.
- LangGraph or a heavier multi-agent runtime remains out of scope until a later ADR supersedes this decision.
