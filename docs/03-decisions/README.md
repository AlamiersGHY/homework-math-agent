# Architecture Decision Records

This directory stores durable decisions that affect future product, architecture, workflow, deployment, or provider choices.

Accepted ADRs are binding until a later ADR explicitly supersedes them. Do not silently bypass an accepted ADR during implementation.

## ADR Index

| ADR | Status | Title | Impact |
| --- | --- | --- | --- |
| `ADR-001-project-structure.md` | accepted | Project Structure | Root SDD layer, `apps/web`, `apps/api`, no single root `src/` |
| `ADR-002-mvp-architecture.md` | accepted | MVP Architecture | SSE chat, SQLite allowed, service pipeline, provider boundaries, no LangGraph for MVP |
| `ADR-003-tech-stack.md` | accepted | MVP Tech Stack | npm, venv/pip, Tailwind local components, fetch stream, SQLAlchemy lightweight, no LangGraph for MVP |

## When To Add An ADR

Add an ADR when a decision is likely to affect future work, including:

- framework or library choices
- data model or persistence strategy
- API contract changes
- authentication or permission behavior
- routing or navigation structure
- state management approach
- directory conventions
- testing strategy
- deployment or release process
- external provider choices for LLM, OCR, plotting, storage, or retrieval

## When To Update Or Supersede

- Use a new ADR with `Status: accepted` to supersede an older accepted ADR.
- Mark the older ADR as `superseded` only when the replacement is clear.
- Do not edit historical context to make an old decision look current.
- Minor clarifications that do not change the decision may be added to the existing ADR.

## When An ADR Is Not Needed

Do not add an ADR for:

- small implementation details inside an already accepted architecture
- one-off bug fixes
- copy changes
- temporary scaffolding that does not change project direction
- local refactors that preserve public contracts and directory rules

## ADR Format

```md
# ADR-XXX: Title

Status: proposed | accepted | superseded

## Context

## Decision

## Consequences
```
