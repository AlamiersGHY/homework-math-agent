# Completed Work

## SDD Foundation Skeleton

- Created the project-level directory structure.
- Added bilingual `README.md`.
- Added the SDD documentation skeleton under `docs/`.
- Added the eval entry under `evals/`.
- Recorded `ADR-001-project-structure.md`.

## Product Docs Staticization

- Filled `docs/00-product/vision.md` with product positioning, target users, value, and principles.
- Filled `docs/00-product/scope.md` with current MVP scope, optional work, exclusions, answer modes, and success criteria.
- Filled `docs/00-product/roadmap.md` with phased delivery from SDD foundation to deployment and feedback.
- Updated `docs/INDEX.md` and `docs/04-logs/active.md` so agents can route to the product source of truth.

## Architecture Docs Staticization

- Filled `docs/01-architecture/system-overview.md` with MVP system shape, service boundaries, provider abstractions, and data flows.
- Filled `docs/01-architecture/directory-rules.md` with project-level, frontend, backend, eval, reference, and script placement rules.
- Filled `docs/01-architecture/api-contracts.md` with first backend contracts for health, SSE chat, OCR recognition, and plot preview.
- Filled `docs/01-architecture/coding-standards.md` with lightweight frontend/backend coding rules.
- Recorded `docs/03-decisions/ADR-002-mvp-architecture.md`.
- Updated `docs/INDEX.md` and `docs/04-logs/active.md` for architecture routing and next work.

## Workflow Docs Staticization

- Filled `docs/02-workflow/definition-of-done.md` with completion states, task-specific done criteria, and decision stop rules.
- Filled `docs/02-workflow/testing-strategy.md` with unit, API, integration, frontend, and eval validation expectations.
- Filled `docs/02-workflow/release-checklist.md` with MVP release and demo checks.
- Added `docs/02-workflow/feedback-loop.md` for feedback triage, decision, execution, and SDD recording.
- Updated `AGENTS.md`, `docs/INDEX.md`, and `docs/04-logs/active.md` so agents can route to workflow docs.

## SDD System Activation

- Expanded `docs/03-decisions/README.md` with an ADR index and ADR usage rules.
- Replaced the empty `docs/04-logs/tech-debt-tracker.md` with a maintainable tracker and current deferred work.
- Activated `evals/README.md`, `evals/agent_cases.json`, and `evals/visual_cases.json` with initial behavior anchors.
- Expanded `scripts/README.md` with intended project-level automation command contracts.
- Updated `docs/04-logs/active.md` so the next stage can focus on frontend/backend scaffold planning.

## Tech Stack And Coding Standards Staticization

- Added `docs/01-architecture/tech-stack.md` as the formal MVP technology stack source.
- Rewrote `docs/01-architecture/coding-standards.md` with concrete Next.js, TypeScript, Tailwind, SSE, FastAPI, Pydantic, SQLite, SQLAlchemy, provider, and testing rules.
- Recorded `docs/03-decisions/ADR-003-tech-stack.md`.
- Updated `docs/03-decisions/README.md`, `docs/INDEX.md`, and `docs/04-logs/active.md` so agents route to the formal tech stack.

## Frontend/Backend Scaffold And Local Git Init

- Initialized the local Git repository without connecting a remote.
- Added a root `.gitignore` for Node, Python, local env files, SQLite files, caches, and build outputs.
- Scaffolded `apps/web` as a Next.js App Router, TypeScript, Tailwind application using npm.
- Scaffolded `apps/api` as a FastAPI, Pydantic, pytest backend using Python venv and pip.
- Implemented `GET /health` and mock `POST /chat/stream` SSE endpoints.
- Added backend API tests for health and SSE event shape.
- Verified backend pytest, backend uvicorn health smoke, frontend typecheck, frontend build, and frontend dev server smoke.

## Planning Workflow Staticization

- Added `docs/02-workflow/planning-workflow.md` for fuzzy requirement intake, context checking, solution-card output, execution planning, and Decision Gate behavior.
- Updated `AGENTS.md` and `docs/INDEX.md` so fuzzy requirements, UI ideas, product improvements, and planning requests route to the planning workflow.
- Recorded `docs/03-decisions/ADR-004-planning-workflow.md`.
- Clarified that active work belongs in `active.md`, completed delivery summaries belong in `completed.md`, and long-term constraints belong in ADRs.

## Git Checkpoint Workflow Staticization

- Added `docs/03-decisions/ADR-005-git-checkpoint-workflow.md`.
- Updated `AGENTS.md` and `docs/02-workflow/definition-of-done.md` so complete deliverable units create local Git checkpoint commits after verification and SDD sync.
- Clarified that Agents should stage only files belonging to the completed unit and must not commit ignored artifacts, secrets, dependency folders, local environments, or unrelated user changes.
