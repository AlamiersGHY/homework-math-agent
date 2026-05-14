# ADR-003: MVP Tech Stack

Status: accepted

## Context

The early root-level `tech-stack.md` mixed useful choices with older assumptions. The current MVP scope and architecture exclude heavy LangGraph orchestration, full RAG, and unnecessary frontend/backend complexity.

The project needs a formal source of truth for scaffold and implementation decisions so future agents do not re-decide package management, UI strategy, SQLite usage, or SSE client behavior.

## Decision

Use this MVP tech stack:

- Frontend package manager: npm.
- Frontend framework: Next.js App Router with TypeScript.
- Styling: Tailwind CSS with local lightweight components.
- UI libraries: no shadcn/ui for MVP.
- Math rendering: KaTeX / react-katex.
- Plot rendering: Plotly-style specs rendered on the frontend.
- API client: native `fetch`.
- Chat streaming client: `fetch` + `ReadableStream` for `POST /chat/stream`.
- Backend environment: venv + pip.
- Backend framework: FastAPI with Pydantic v2.
- Testing: pytest / pytest-asyncio for backend; frontend checks after scaffold.
- Persistence: SQLite with lightweight SQLAlchemy 2 usage.
- Migrations: no Alembic for MVP.
- Agent orchestration: explicit service pipeline, no LangGraph for MVP.

## Consequences

- Frontend/backend scaffold can proceed without re-deciding basic tooling.
- The chat stream contract remains compatible with POST because the frontend will not depend on native `EventSource`.
- SQLite can be used pragmatically without forcing a full migration setup.
- The UI can stay lightweight until real product needs justify a component library.
- Introducing pnpm, uv, shadcn/ui, Alembic, LangGraph, or full RAG requires a later ADR or an update to this one.
