# ADR-001: Project Structure

Status: accepted

## Context

The project needs a lightweight SDD / Harness layer while keeping frontend and backend applications independently runnable and deployable.

## Decision

Use a project-level structure with SDD and automation directories at the root, and application code under `apps/`:

- `apps/web/` for the frontend application.
- `apps/api/` for the backend application.
- `docs/` for SDD documentation.
- `evals/` for behavior evaluation cases.
- `scripts/` for repeatable automation commands.
- `references/` for external source materials.
- `tests/` for cross-app or end-to-end tests.

Do not use a single root-level `src/` directory for all implementation code.

## Consequences

- Frontend and backend can be developed and deployed independently.
- The root directory remains the orchestration layer for documentation, evals, references, and automation.
- Future agents should check `docs/01-architecture/directory-rules.md` before adding files.
