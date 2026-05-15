# Active Work

## Current Phase

Agentic RAG Prototype / Intelligent Course Assistant Prototype.

## Current Goal

Phase 1 planner skeleton is implemented and release-validated. The planner now emits structured decisions for retrieval, plotting, clarification, answer mode, memory action, and reason while keeping full PDF RAG, citations, preferences, and memory writes out of this completion unit.

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
- `docs/03-decisions/ADR-007-agentic-rag-prototype.md`
- `docs/03-decisions/ADR-008-planner-driven-service-pipeline.md`
- `docs/03-decisions/README.md`
- `docs/02-workflow/planning-workflow.md`
- `docs/02-workflow/definition-of-done.md`
- `docs/02-workflow/testing-strategy.md`
- `docs/02-workflow/feedback-loop.md`
- `docs/02-workflow/release-checklist.md`
- `evals/README.md`
- `evals/agent_cases.json`
- `evals/visual_cases.json`
- `AGENTIC_RAG_HANDOFF.md`
- `apps/README.md`
- `apps/web/README.md`
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/MathMarkdown.tsx`
- `apps/web/src/features/chat/ChatWorkspace.tsx`
- `apps/web/src/features/plots/PlotViewer.tsx`
- `apps/web/src/lib/api/chatStream.ts`
- `apps/web/src/lib/api/sessions.ts`
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
- `apps/api/src/math_agent_api/db/repositories.py`
- `apps/api/src/math_agent_api/routers/plots.py`
- `apps/api/src/math_agent_api/routers/sessions.py`
- `apps/api/src/math_agent_api/schemas/chat.py`
- `apps/api/src/math_agent_api/schemas/plots.py`
- `apps/api/src/math_agent_api/schemas/agent_policy.py`
- `apps/api/src/math_agent_api/services/agent_policy_planner.py`
- `apps/api/src/math_agent_api/services/chat_service.py`
- `apps/api/src/math_agent_api/services/ocr_service.py`
- `apps/api/src/math_agent_api/services/plot_service.py`
- `apps/api/src/math_agent_api/services/session_service.py`
- `apps/api/tests/test_agent_policy_planner.py`
- `apps/api/tests/test_chat_stream.py`
- `scripts/run_evals.py`
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
- The completed MVP demo runtime remained a lightweight service pipeline: no LangGraph, no RAG, no login/account system for that demo baseline.
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
- User feedback on the MVP workspace UI has been handled as a focused refinement unit: the app now uses a fixed-height learning workspace shell, keeps the transcript as the only primary scroll region, and keeps the composer pinned to the viewport bottom.
- The session rail now supports deleting local demo sessions; deletion removes the session with its messages and artifacts.
- Chat SSE now returns local `user_message_id` and `assistant_message_id` so the frontend can replace temporary message IDs and persist plot artifacts against the correct assistant message.
- Plot preview can persist `plot_preview` artifacts when called with a known `session_id`; session detail can restore generated Plotly specs without rederiving math in the frontend.
- The frontend now treats image upload as an inline composer attachment: OCR text is copied into the normal input area for user editing and still requires an explicit send.
- Plot rendering now lives inside the relevant assistant message and includes a larger modal view for detailed inspection.
- Browser QA coverage now checks fixed app-shell viewport fit, inline OCR, plot modal, plot history restore, and session deletion. Latest release validation passed on 2026-05-15 14:29 +08 with screenshots under `.cache/qa/20260515-142929`.
- Agentic RAG Prototype direction has been accepted for the next stage through ADR-007.
- Phase 1 will use a planner-driven explicit service pipeline through ADR-008; LangGraph remains out of scope.
- Phase 1 planner skeleton is implemented as `agent_policy_planner` with a Pydantic `AgentPolicyPlan`.
- Chat SSE metadata now keeps existing top-level `question_type`, `should_visualize`, and `plot_suggestion` fields while adding additive `planner` metadata.
- Planner decisions are covered by unit tests and deterministic evals for concept retrieval intent, proof guidance, OCR-confirmed input, visualization, broad clarification, off-topic input, and bounded plot scope.
- Frontend chat types now understand planner metadata and the expanded question-type enum; the UI still consumes the existing chat-first metadata surface rather than showing raw planner debug panels.

## Next Tasks

- Create a local Git checkpoint for the planner implementation unit.
- Before starting Phase 4.2 PDF ingestion/retrieval, add or update a retrieval/citation strategy ADR covering PDF parsing, chunk metadata, retrieval method, citation safety, and dependency choices.
- Defer live Doubao OCR smoke until the configured `DOUBAO_VISION_MODEL` points to an accessible Ark endpoint.

## Blockers

- Live Doubao OCR smoke checks require local API keys in `apps/api/.env`.
- Doubao OCR live smoke additionally requires a vision-capable model or endpoint id in `DOUBAO_VISION_MODEL`.
- Mathpix is not the active OCR provider because the user does not accept its current setup/billing requirement for this MVP; keep it as a future adapter path only.
- `npm audit` still reports 2 moderate findings through the current Next/PostCSS dependency chain; do not run `npm audit fix --force` without a release dependency review.
- PDF ingestion, retrieval, citations, preferences, and memory are accepted next-stage scope but not part of Phase 1 planner completion.
- `.\scripts\check.ps1` passed on 2026-05-15 15:19 +08 after moving pytest temporary directories to the system temp path to avoid Windows cache-directory permission locks.
- `.\scripts\release-check.ps1` passed on 2026-05-15 15:20 +08: backend pytest, deterministic evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory completed.

## Exit Checklist

- New implementation should keep route handlers thin and use service/provider boundaries from architecture docs.
- API changes must stay aligned with `docs/01-architecture/api-contracts.md`.
- Frontend chat work should use native `fetch` stream for `POST /chat/stream`.
- Math rendering/UI tasks must be checked with at least one formula-heavy answer, not only the empty starter screen.
- OCR must return editable text for user confirmation and must not auto-submit recognized text into chat.
- Plot viewer must consume backend Plotly-style specs and must not rederive math in the UI component.
- Plot artifacts must be generated by backend plot preview and restored from session detail when available.
- Session deletion must remain local-only and must remove the session's messages/artifacts without introducing account semantics.
- Message IDs from SSE are opaque frontend identifiers; UI code should not parse their format except when passing them back as optional artifact links.
- Session persistence must remain local/lightweight and must not introduce accounts, login, permissions, or cross-device sync.
- Planner metadata must be additive; existing frontend-visible chat metadata fields must remain compatible.
- Planner output must be Pydantic-validated and have deterministic fallback behavior.
- Retrieval/citation features must never fabricate document names, pages, sections, or chunk metadata.
- The UI must remain chat-first and must not become a manual tool workbench.
- User-facing UI should show learning state and next actions, not raw provider/session/debug internals.
- Before finalizing a coding task, run the relevant app-local tests or explain what could not be verified.
- Release validation should use `.\scripts\release-check.ps1`; pass `-LiveLLM` only when real LLM credentials are locally configured.
- After completing a coherent deliverable unit, create a local Git checkpoint commit unless blocked by unrelated changes or explicit user instruction.
