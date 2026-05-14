# Active Work

## Current Phase

Phase 1 first chat slice.

## Current Goal

Move from the mock SSE chat UI slice toward real LLM provider integration.

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
- `docs/03-decisions/ADR-004-planning-workflow.md`
- `docs/03-decisions/ADR-005-git-checkpoint-workflow.md`
- `docs/03-decisions/README.md`
- `docs/02-workflow/planning-workflow.md`
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
- `apps/web/src/app/page.tsx`
- `apps/web/src/features/chat/ChatWorkspace.tsx`
- `apps/web/src/lib/api/chatStream.ts`
- `apps/web/src/types/chat.ts`
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
- Fuzzy requirement planning now has a routed workflow and ADR.
- Complete deliverable units now require an automatic local Git checkpoint when safe.
- First web chat UI slice is implemented with answer mode switching, mock SSE streaming, API status, and metadata display.

## Next Tasks

- Connect a real LLM provider behind the existing chat service/provider boundary.
- Preserve the current `POST /chat/stream` contract while replacing mock answer generation.
- Add or update eval cases for answer mode behavior once real LLM output is introduced.
- Add project-level wrapper scripts for common `dev`, `test`, and `check` workflows.
- Start connecting eval cases to an executable runner after the first chat slice exists.
- Add OCR and plot endpoint skeletons when their first UI flows are ready.

## Blockers

- None.

## Exit Checklist

- New implementation should keep route handlers thin and use service/provider boundaries from architecture docs.
- API changes must stay aligned with `docs/01-architecture/api-contracts.md`.
- Frontend chat work should use native `fetch` stream for `POST /chat/stream`.
- Fuzzy feature or UI ideas should start with `docs/02-workflow/planning-workflow.md` and a short solution card.
- Before finalizing a coding task, run the relevant app-local tests or explain what could not be verified.
- After completing a coherent deliverable unit, create a local Git checkpoint commit unless blocked by unrelated changes or explicit user instruction.
