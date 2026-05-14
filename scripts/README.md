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

## Project-Level Commands

Project-level scripts now wrap the app-local commands through these stable entry points:

| Command | Purpose |
| --- | --- |
| `.\scripts\test.ps1` | Run deterministic backend pytest coverage. |
| `.\scripts\eval.ps1` | Run deterministic Agent and visualization evals from `evals/`. |
| `.\scripts\check.ps1` | Run backend tests, evals, frontend typecheck, and frontend build sequentially. |

Still planned:

| Command | Purpose |
| --- | --- |
| `dev` | Start frontend and backend together for local development. |
| `release-check` | Run MVP release checks before deployment or demo, including browser QA and provider smoke checks. |

## Rules

- Scripts should call app-local commands instead of hiding app details.
- Scripts must fail loudly when a required app has not been scaffolded.
- Scripts should not encode product or architecture decisions that are absent from `docs/`.
- When a script becomes the official way to verify work, update `docs/02-workflow/testing-strategy.md`.
- `check.ps1` intentionally clears `apps/web/.next` before typecheck and runs the Next checks sequentially to avoid generated-type races.

## Current Status

The first runnable project-level wrappers exist for `test`, `eval`, and `check`. Local development and release-check orchestration remain tracked in `docs/04-logs/tech-debt-tracker.md`.
