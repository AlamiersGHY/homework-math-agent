# Active Work

## Current Phase

Full MVP demo completion.

## Current Goal

Turn the current chat-only slice into a cohesive local MVP demo with chat, answer-mode control, lightweight session history, OCR input confirmation, Plotly-style 2D/3D visualization, automated checks, and release-ready demo documentation.

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
- `docs/03-decisions/ADR-006-ocr-provider-strategy.md`
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
- `apps/web/package-lock.json`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/MathMarkdown.tsx`
- `apps/web/src/features/chat/ChatWorkspace.tsx`
- `apps/web/src/lib/api/chatStream.ts`
- `apps/web/src/lib/math/normalizeMathMarkdown.ts`
- `apps/web/src/types/chat.ts`
- `apps/api/README.md`
- `apps/api/requirements.txt`
- `apps/api/requirements-dev.txt`
- `apps/api/.env.example`
- `apps/api/src/math_agent_api/core/config.py`
- `apps/api/src/math_agent_api/providers/llm.py`
- `apps/api/src/math_agent_api/providers/ocr.py`
- `apps/api/src/math_agent_api/prompts/chat.py`
- `apps/api/src/math_agent_api/services/chat_service.py`
- `apps/api/src/math_agent_api/services/ocr_service.py`
- `apps/api/src/math_agent_api/services/plot_service.py`
- `apps/api/src/math_agent_api/services/session_service.py`
- `apps/api/tests/test_chat_stream.py`
- `docs/04-logs/tech-debt-tracker.md`
- `scripts/README.md`
- `scripts/browser-qa.ps1`
- `scripts/browser_qa.cjs`
- `scripts/smoke_live_llm.py`

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
- Backend chat now has a configurable OpenAI-compatible LLM provider path with mock fallback.
- `apps/api/.env.example` documents the first DeepSeek-oriented local configuration.
- Chat SSE tests cover mock fallback, provider chunk mapping, and provider error mapping.
- Frontend chat messages now support Markdown and LaTeX rendering.
- Frontend chat has a lightweight new-session flow and can return to the starter screen.
- Completed answers now show follow-up suggestion chips for one-click next turns.
- User feedback exposed poor formula rendering from bare LaTeX output; frontend now normalizes common bare LaTeX patterns before Markdown rendering.
- Backend prompt now explicitly requires renderable Markdown LaTeX delimiters for formulas.
- Current work has been reset from Phase 1 closure to full MVP demo completion.
- Product runtime remains the accepted lightweight service pipeline: no LangGraph, no RAG, no login/account system for this demo.
- OCR strategy is Doubao-first for the real provider, mock-first for automated development and tests, with Mathpix kept as the future professional OCR adapter.
- Session history is accepted as local SQLite-backed demo persistence only.
- UI direction is a productized learning workspace: left session rail, central chat/learning area, text/image input modes, inline OCR confirmation, and inline plot viewer. Backend/debug metadata should not be exposed as normal user-facing UI.
- Backend now has lightweight SQLite session/message/artifact persistence and session read APIs.
- Chat stream now records user and assistant messages when a session is active.
- Backend now has `POST /ocr/recognize` with service/provider boundaries, mock OCR fallback, Doubao Vision provider support, and Mathpix adapter placeholder support.
- Backend now has `POST /plots/preview` for Plotly-style `function2d` and `surface3d` specs.
- Chat metadata now includes a bounded plot suggestion for visualization-oriented questions.
- Frontend workspace has been refactored into a productized learning surface with a local session rail, text/image input modes, OCR confirmation, and Plotly plot rendering.
- Browser QA passed against a mock backend for desktop `1440x1000` and mobile `390x844`: initial layout, chat stream, plot render, and OCR-confirmed chat flow.
- Plot preview and chat metadata now also cover the bounded `region2d` MVP case for simple triangular integration regions.
- Complex implicit surfaces are now treated as out of MVP plotting scope instead of being forced into a `surface3d` suggestion.
- Project-level wrappers now exist for backend tests, deterministic evals, and sequential full checks: `.\scripts\test.ps1`, `.\scripts\eval.ps1`, and `.\scripts\check.ps1`.
- `scripts/run_evals.py` now scores deterministic eval expectations for classification, answer mode propagation, visualization triggers, plot types, and supported Plotly preview generation.
- Project-level local dev and release-check wrappers now exist: `.\scripts\dev.ps1` and `.\scripts\release-check.ps1`.
- Mock API release smoke now covers health, chat SSE, OCR mock recognition, 3D plot preview, region plot preview, and sessions through `scripts/smoke_api.py`.
- Browser QA is now scriptable through `.\scripts\browser-qa.ps1`; it starts isolated mock API/Web processes, checks desktop and mobile viewports, and stores ignored screenshots under `.cache/qa/`. Latest production-build QA passed on 2026-05-15 00:01 +08 with screenshots under `.cache/qa/20260515-000134`.
- `.\scripts\release-check.ps1` passed on 2026-05-15 00:01 +08: backend pytest, deterministic evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory all completed.
- Real OpenAI-compatible LLM smoke passed again on 2026-05-15 00:02 +08 with the local `.env` key: SSE emitted `start/metadata/delta/done` and no `error` event. The repeatable entry is `.\scripts\release-check.ps1 -LiveLLM`.

## Next Tasks

- Run live Doubao OCR smoke after the user adds Doubao credentials.
- Review real model outputs for prompt/LaTeX quality in direct/guided/hint modes.
- Keep running backend tests, frontend typecheck/build, API smoke checks, and browser verification for each completed unit.

## Blockers

- Live Doubao OCR smoke checks require local API keys in `apps/api/.env`.
- Doubao OCR live smoke additionally requires a vision-capable model or endpoint id in `DOUBAO_VISION_MODEL`.
- Mathpix is not the active OCR provider because the user does not accept its current setup/billing requirement for this MVP; keep it as a future adapter path only.
- `npm audit` still reports 2 moderate findings through the current Next/PostCSS dependency chain; do not run `npm audit fix --force` without a release dependency review.

## Exit Checklist

- New implementation should keep route handlers thin and use service/provider boundaries from architecture docs.
- API changes must stay aligned with `docs/01-architecture/api-contracts.md`.
- Frontend chat work should use native `fetch` stream for `POST /chat/stream`.
- Math rendering/UI tasks must be checked with at least one formula-heavy answer, not only the empty starter screen.
- OCR must return editable text for user confirmation and must not auto-submit recognized text into chat.
- Plot viewer must consume backend Plotly-style specs and must not rederive math in the UI component.
- Session persistence must remain local/lightweight and must not introduce accounts, login, permissions, or cross-device sync.
- User-facing UI should show learning state and next actions, not raw provider/session/debug internals.
- Before finalizing a coding task, run the relevant app-local tests or explain what could not be verified.
- Release validation should use `.\scripts\release-check.ps1`; pass `-LiveLLM` only when real LLM credentials are locally configured.
- After completing a coherent deliverable unit, create a local Git checkpoint commit unless blocked by unrelated changes or explicit user instruction.
