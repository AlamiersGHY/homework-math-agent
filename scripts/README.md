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
| `.\scripts\dev.ps1` | Start the API and web app together for local development. |
| `.\scripts\test.ps1` | Run deterministic backend pytest coverage. |
| `.\scripts\eval.ps1` | Run deterministic Agent and visualization evals from `evals/`. |
| `.\scripts\check.ps1` | Run backend tests, evals, frontend typecheck, and frontend build sequentially. |
| `.\scripts\browser-qa.ps1` | Run production-build desktop/mobile Playwright QA against mock API/OCR. |
| `.\scripts\release-check.ps1` | Run full local release validation: `check`, mock API smoke, browser QA, and dependency audit advisory. |

Still planned:

| Command | Purpose |
| --- | --- |
| Live OCR smoke | Exercise Doubao Vision once `DOUBAO_API_KEY` and `DOUBAO_VISION_MODEL` are configured locally. |

## Rules

- Scripts should call app-local commands instead of hiding app details.
- Scripts must fail loudly when a required app has not been scaffolded.
- Scripts should not encode product or architecture decisions that are absent from `docs/`.
- When a script becomes the official way to verify work, update `docs/02-workflow/testing-strategy.md`.
- `check.ps1` intentionally clears `apps/web/.next` before typecheck and runs the Next checks sequentially to avoid generated-type races.
- `browser-qa.ps1` rebuilds the frontend with the QA API base URL before starting `next start`; this avoids stale `NEXT_PUBLIC_API_BASE_URL` bundles.
- `release-check.ps1` treats `npm audit --omit=dev` findings as advisory by default because TD-005 is tracked; pass `-StrictAudit` to fail on audit findings.
- `release-check.ps1 -LiveLLM` also runs the real OpenAI-compatible LLM smoke when local credentials are configured.
- `smoke_api.py` forces mock LLM/OCR providers and uses a temporary SQLite file so release smoke does not depend on external keys. It also covers local PDF upload, retrieval, chat citation metadata, and document deletion.

## Current Status

Runnable project-level wrappers exist for local dev, tests, evals, checks, browser QA, and release validation. Live Doubao OCR smoke still requires separate execution after credentials are added.
