# Active Work

## Current Phase

Phase 1 implementation bootstrap.

## Current Goal

Use the runnable frontend/backend scaffold to implement the first useful chat slice.

## Relevant Docs

- `AGENTS.md`
- `docs/INDEX.md`
- `docs/00-product/vision.md`
- `docs/00-product/scope.md`
- `docs/00-product/roadmap.md`
- `docs/01-architecture/system-overview.md`
- `docs/01-architecture/tech-stack.md`
- `docs/01-architecture/directory-rules.md`
- `docs/01-architecture/api-contracts.md`
- `docs/01-architecture/coding-standards.md`
- `docs/03-decisions/ADR-001-project-structure.md`
- `docs/03-decisions/ADR-002-mvp-architecture.md`
- `docs/03-decisions/ADR-003-tech-stack.md`
- `docs/03-decisions/README.md`
- `docs/02-workflow/definition-of-done.md`
- `docs/02-workflow/testing-strategy.md`
- `docs/02-workflow/feedback-loop.md`
- `docs/02-workflow/release-checklist.md`
- `evals/README.md`
- `evals/agent_cases.json`
- `evals/visual_cases.json`
- `apps/README.md`
- `apps/web/README.md`
- `apps/web/package.json`
- `apps/api/README.md`
- `apps/api/requirements.txt`
- `apps/api/requirements-dev.txt`
- `docs/04-logs/tech-debt-tracker.md`
- `scripts/README.md`

## In Progress

- Product documents have been staticized.
- Architecture documents have been staticized.
- Workflow documents have been staticized.
- Decisions/logs/evals/scripts have been activated enough to prevent dead-file drift.
- Tech stack and coding standards have been staticized.
- Local Git repository has been initialized.
- `apps/web` has a runnable Next.js scaffold.
- `apps/api` has a runnable FastAPI scaffold.
- Backend `GET /health` and mock `POST /chat/stream` SSE are implemented and tested.
- Frontend minimal scaffold page builds and starts locally.

## Next Tasks

- Add the first frontend chat UI and API client against the mock SSE endpoint.
- Add project-level wrapper scripts for common `dev`, `test`, and `check` workflows.
- Start connecting eval cases to an executable runner after the first chat slice exists.
- Add OCR and plot endpoint skeletons when their first UI flows are ready.

## Blockers

- None.

## Exit Checklist

- New implementation should keep route handlers thin and use service/provider boundaries from architecture docs.
- API changes must stay aligned with `docs/01-architecture/api-contracts.md`.
- Frontend chat work should use native `fetch` stream for `POST /chat/stream`.
- Before finalizing a coding task, run the relevant app-local tests or explain what could not be verified.
