# Scripts

Repeatable automation scripts live here.

Do not create fake scripts. This file defines the intended project-level script contract and points to currently runnable app-local commands.

## Current App Commands

The applications are scaffolded and have local commands:

| Area | Command | Working Directory | Purpose |
| --- | --- | --- | --- |
| API | `.\.venv\Scripts\python -m pytest` | `apps/api` | Run backend tests. |
| API | `$env:PYTHONPATH = "src"; .\.venv\Scripts\python -m uvicorn math_agent_api.main:app --reload` | `apps/api` | Start the FastAPI dev server. |
| Web | `npm run dev` | `apps/web` | Start the Next.js dev server. |
| Web | `npm run build` | `apps/web` | Build the frontend. |
| Web | `npm run typecheck` | `apps/web` | Run TypeScript checks. |

## Intended Commands

Future project-level scripts should wrap the app-local commands through these stable entry points:

| Command | Purpose |
| --- | --- |
| `dev` | Start frontend and backend for local development. |
| `test` | Run deterministic tests across available apps. |
| `eval` | Run Agent behavior evals from `evals/`. |
| `check` | Run lightweight validation before a task is considered done. |
| `release-check` | Run MVP release checks before deployment or demo. |

## Rules

- Scripts should call app-local commands instead of hiding app details.
- Scripts must fail loudly when a required app has not been scaffolded.
- Scripts should not encode product or architecture decisions that are absent from `docs/`.
- When a script becomes the official way to verify work, update `docs/02-workflow/testing-strategy.md`.

## Current Status

No runnable project-level scripts exist yet. App-local commands are available, and project-level wrapper implementation is tracked in `docs/04-logs/tech-debt-tracker.md`.
