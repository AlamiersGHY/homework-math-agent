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

## First Chat UI Slice

- Replaced the scaffold landing page with a lightweight math learning workspace UI.
- Added answer mode switching for direct, guided, and hint modes.
- Added a typed frontend API layer for `GET /health` and `POST /chat/stream`.
- Added a native `fetch` stream SSE parser for `start`, `metadata`, `delta`, `error`, and `done` events.
- Connected the UI to the backend mock chat stream and displayed question type, visualization suggestion, session id, and streaming state.
- Verified backend pytest, frontend typecheck, frontend build, direct SSE event shape, and Chrome headless layout rendering.

## Real LLM Provider Integration

- Added backend settings loading for local `.env` configuration.
- Added an OpenAI-compatible LLM provider boundary for DeepSeek or compatible proxy providers.
- Added a mock LLM fallback when no API key is configured.
- Rewired `POST /chat/stream` so the route contract remains SSE while the service streams provider chunks as `delta` events.
- Added first chat prompt construction for direct, guided, and hint answer modes.
- Added `.env.example` and API README instructions for local DeepSeek configuration.
- Updated agent eval cases to guard against leaking provider plumbing into the learning conversation.
- Verified backend pytest for health, SSE event shape, mock fallback, provider chunk mapping, and provider error mapping.

## Chat Experience Closure

- Added Markdown and LaTeX rendering for chat messages using `react-markdown`, `remark-math`, `rehype-katex`, and KaTeX CSS.
- Added a dedicated `MathMarkdown` component so math rendering stays out of the main chat workspace logic.
- Added a lightweight new-session flow that clears the current conversation and returns the user to the starter screen.
- Kept multi-turn context in React state and continued sending previous turns to the existing chat stream API.
- Added follow-up suggestion chips after completed answers for quick next-turn actions such as direct answer, hint, guided explanation, or similar exercise.
- Updated the web README and active work log to reflect the current Phase 1 chat experience state.
- Verified frontend typecheck, frontend production build, backend pytest, and headless Chrome layout rendering of the starter screen.

## Math Rendering Feedback Fix

- Classified user feedback as a current MVP UX/Agent behavior issue because formula readability is central to the chat learning loop.
- Added frontend normalization for common bare LaTeX output patterns before Markdown rendering, including `\(...\)`, `\[...\]`, bare LaTeX command runs, and bracketed formula lines.
- Tightened the backend chat prompt so real LLM output should use `$...$` and `$$...$$` delimiters instead of bare `\frac`, `\lim`, or square-bracketed formulas.
- Added an eval case requiring renderable Markdown LaTeX and forbidding bare math commands in answer output.

## Full MVP Demo Takeover Planning

- Reset active work from Phase 1 chat closure to full MVP demo completion.
- Confirmed the demo scope: chat, answer modes, local session history, OCR confirmation, Plotly-style visualization, automated checks, SDD sync, and checkpoint commits.
- Confirmed exclusions for this demo: no RAG, no LangGraph, no login/account system, no professional implicit-surface modeling.
- Recorded `ADR-006-ocr-provider-strategy.md`: mock-first for tests, Doubao Vision as the preferred live MVP OCR provider, and Mathpix as a future professional adapter.
- Clarified the target UI direction as a productized learning workspace rather than a debug-heavy chat panel.

## Lightweight Session Persistence

- Added SQLite-backed session, message, and artifact tables for local demo history.
- Added backend session repository/service boundaries and `GET /sessions` / `GET /sessions/{session_id}` APIs.
- Updated chat streaming so user and assistant messages are persisted without changing the SSE contract.
- Documented `DATABASE_URL` in the API environment example and README.
- Verified backend pytest with session persistence coverage.

## OCR Backend Slice

- Added `POST /ocr/recognize` with multipart upload handling and unified error responses.
- Added OCR schema, service, provider boundary, mock provider, Doubao Vision provider path, and future Mathpix adapter path.
- Added OCR configuration placeholders to `.env.example` and documented Doubao credential setup in the API README.
- Verified backend pytest with OCR API, validation, mock fallback, and Doubao provider selection coverage.

## Plot Backend Slice

- Added `POST /plots/preview` for Plotly-style `function2d` and `surface3d` specs.
- Added safe MVP expression evaluation for bounded math functions, variables, and finite ranges.
- Added chat metadata plot suggestions for simple visualization-oriented questions.
- Verified backend pytest with 2D plot, 3D surface, invalid expression, invalid range, and chat plot-suggestion coverage.

## Frontend MVP Workspace Slice

- Reworked the chat-only page into a learning workspace with a local session rail, central transcript, answer-mode controls, and text/image input modes.
- Added frontend API helpers for session history, OCR recognition, and plot preview.
- Added editable OCR confirmation before recognized text enters chat.
- Added a Plotly viewer that renders backend Plotly-style specs without rederiving math in the UI.
- Added desktop and mobile browser QA coverage for initial layout, chat streaming, plot rendering, and OCR-confirmed chat flow.

## Automation And Eval Wrappers

- Added project-level wrappers for backend tests, deterministic behavior evals, and sequential full checks.
- Added a deterministic eval runner for current classification, answer mode, visualization trigger, plot-type, and Plotly preview behavior.
- Closed the eval-runner tech debt and resolved the known Next typecheck/build race through sequential `check` orchestration.
- Extended the bounded plotting slice so simple triangular `region2d` integration regions are supported and complex implicit surfaces are not forced into MVP plot suggestions.

## Release Automation And Provider Smoke

- Added local dev orchestration and release-check wrappers.
- Added mock API smoke coverage for health, chat SSE, OCR, plot preview, region preview, and sessions.
- Added browser QA automation for production-build desktop/mobile demo checks.
- Added a repeatable optional live OpenAI-compatible LLM smoke path through `release-check.ps1 -LiveLLM`.
- Verified the release path on 2026-05-15 00:01 +08 with `.\scripts\release-check.ps1`: backend pytest, evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory completed.
- Verified the local real OpenAI-compatible LLM path with the user's configured `.env` key; the latest smoke passed on 2026-05-15 00:02 +08 with SSE `start/metadata/delta/done` and no `error` event.

## Workspace Session And Artifact Refinement

- Reworked the workspace UI into a fixed-height app shell with a pinned composer and a transcript-centered scroll model to remove the large blank lower-page behavior reported in user screenshots.
- Replaced the separate OCR tab flow with an inline composer attachment flow: image upload runs OCR, fills the normal input with editable text, and still requires explicit user send.
- Added basic local session deletion and kept it scoped to SQLite demo history; deleting a session removes its messages and artifacts.
- Added persisted message IDs to chat SSE so generated artifacts can be associated with stable assistant messages.
- Persisted generated plot previews as `plot_preview` session artifacts and restored them from history without regenerating or rederiving math in the UI.
- Added message-level Plotly rendering with a larger modal view for 2D/3D/region plots.
- Expanded browser QA to cover app-shell viewport fit, inline OCR, plot modal, history plot restore, and session deletion.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 14:29 +08: backend pytest, evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory completed.

## Agentic RAG SDD Direction And Planner Skeleton

- Accepted the Agentic RAG Prototype / Intelligent Course Assistant Prototype direction through `ADR-007` and `ADR-008`.
- Added a structured planner service and Pydantic `AgentPolicyPlan` for question type, retrieval intent, plot intent, clarification, answer mode, memory action, and reason.
- Kept chat SSE metadata backward-compatible by preserving `question_type`, `should_visualize`, and `plot_suggestion` while adding additive `planner` metadata.
- Updated deterministic evals and backend tests so planner behavior is checked for concept, proof, computation, OCR-confirmed, visualization, broad clarification, off-topic, and citation-safety-adjacent cases.
- Verified `.\scripts\check.ps1` on 2026-05-15 15:19 +08: backend pytest, deterministic evals, frontend typecheck, and frontend production build passed.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 15:20 +08: backend pytest, deterministic evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory completed.

## Session State Restoration And RAG Foundation UI

- Reclassified the current RAG/agent state honestly in SDD: planner/API metadata was complete, but PDF ingestion, retrieval, citations, preferences, memory, and automatic retrieval execution were not yet implemented.
- Added `ADR-009-retrieval-citation-strategy.md` as the proposed local-first PDF retrieval and citation safety strategy for the next RAG unit.
- Updated session detail behavior so local history returns full ordered messages and ordered artifacts instead of a fixed 50-message detail slice.
- Persisted assistant-turn `chat_metadata` and `plot_suggestion` artifacts so historical sessions can restore planner/visualization state even when the user had not generated a plot yet.
- Made plot preview persistence fail explicitly for unknown sessions and kept generated plot artifacts linked to stable assistant message IDs.
- Updated the frontend history restore path to recover generated plots and plot suggestions, stop parsing message ID prefixes, and tolerate older unlinked plot artifacts.
- Refined the chat-first UI baseline with a quieter session rail, reduced empty space, compact mode controls, cleaner header, and no raw debug/provider metadata in the user-facing surface.
- Expanded browser QA to cover persisted plot binding, generated plot replay from history, suggestion-only history replay, inline OCR composer flow, plot modal, session deletion, and desktop/mobile viewport fit.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 17:39 +08: backend pytest, deterministic evals, frontend typecheck/build, mock API smoke, browser QA, and dependency audit advisory completed; audit remains advisory under TD-005.

## PDF RAG And Citation V1

- Accepted and implemented `ADR-009-retrieval-citation-strategy.md` for local-first PDF retrieval and citation safety.
- Added PyMuPDF-backed PDF parsing behind a document parser provider boundary.
- Added SQLite document and chunk records with file hash dedupe, page-aware chunk metadata, warnings, and cascade deletion.
- Added `POST /documents/upload`, `GET /documents`, `DELETE /documents/{document_id}`, and `POST /retrieval/search`.
- Added deterministic local lexical retrieval that returns structured source metadata and empty results for low-confidence or missing material instead of fabricating sources.
- Wired planner-triggered retrieval into `POST /chat/stream`; chat metadata now distinguishes retrieval intent, retrieval attempt, retrieved sources, and citations.
- Injected retrieved snippets into the chat prompt with citation instructions while keeping normal chat resilient when retrieval is empty or unavailable.
- Persisted citation metadata in `chat_metadata` artifacts so historical sessions restore source cards.
- Added a compact chat-first materials strip in the frontend for PDF upload/list/delete and source cards under assistant answers.
- Extended mock API smoke and browser QA to cover PDF upload, retrieval, citation display, citation history replay, material deletion, no raw debug leakage, and desktop/mobile viewport fit.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 18:10 +08: 47 backend tests passed, deterministic evals passed, frontend typecheck/build passed, mock API smoke passed, browser QA passed with screenshots under `.cache/qa/20260515-181039`, and dependency audit advisory remained tracked under TD-005.

## Attachment UX And Automatic Plot Execution

- Added a shared frontend API client that normalizes backend JSON errors, hides raw browser `Failed to fetch` text, and retries configured/local API base candidates for local demo runs.
- Replaced visible OCR text prefill with chat-style multi-image attachment cards; OCR now runs after explicit send and sends hidden `confirmed_ocr_text` to the chat stream.
- Added image attachment thumbnails in user messages and a preview/marking modal for composer image cards.
- Executed planner-provided plot suggestions automatically after assistant message persistence, including persisted history restore for generated plot previews.
- Added minimum `implicit3d` support for `x^4 + y^4 + z^4 = 1` using Plotly `isosurface`, with planner/test/eval coverage and no `sin` fallback.
- Fixed planner classification for explicit `y = f(x)` graph requests so they use `function2d`, including English `Draw the graph of y = sin(x)`.
- Extended browser QA to cover PDF connection failure retry, hidden OCR attachment flow, multi-image thumbnails, image preview modal, automatic plot generation, and implicit 3D history restore.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 22:31 +08: 52 backend tests passed, deterministic evals passed, frontend typecheck/build passed, mock API smoke passed, browser QA passed with screenshots under `.cache/qa/20260515-223152`, and dependency audit advisory remained tracked under TD-005.

## Implicit 3D Plot Render Fix And API Base Clarification

- Fixed the implicit 3D Plotly spec for equations such as `x^4 + y^4 + z^4 = 1`: backend now emits a residual field around the zero level set with a nonzero isosurface band instead of `isomin == isomax`.
- Updated plot tests so valid implicit surfaces must have a real isosurface interval and sampled values on both sides of zero.
- Cleaned the plot viewer labels for `implicit3d`, exposed Plotly render failures in the related assistant message, and kept the frontend consuming backend Plotly specs rather than rederiving math.
- Strengthened browser QA to capture runtime errors and verify implicit 3D Plotly WebGL canvas painting, not only the presence of `.js-plotly-plot`.
- Added `apps/web/.env.example` and clarified README setup: direct `apps/web` starts need `NEXT_PUBLIC_API_BASE_URL`, while `.\scripts\dev.ps1` injects it automatically; PDF material/RAG uses the same local FastAPI API and requires no separate frontend or PDF key.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 23:13 +08: 52 backend tests passed, deterministic evals passed, frontend typecheck/build passed, mock API smoke passed, browser QA passed with screenshots under `.cache/qa/20260515-231310`, and dependency audit advisory remained tracked under TD-005.

## Formula Rendering And Hemisphere Plot Feedback Fix

- Fixed formula rendering for LLM outputs that contain double-backslash LaTeX inside math spans, including partial derivatives and triple integrals.
- Added a mock formula smoke answer and browser QA coverage that restores a historical session, asserts KaTeX rendering, and rejects raw `\frac{\partial...}` / `\iiint` leakage.
- Added planner support for casual upper-hemisphere 3D requests such as "上半球面的三维空间图" and mapped them to a supported `surface3d` preview.
- Allowed the plot service to evaluate the bounded demo parameter `a=1.0` for generated hemisphere surfaces while keeping unsupported names rejected.
- Improved frontend API connection diagnostics so PDF material/RAG failures point users to restarting Next after `NEXT_PUBLIC_API_BASE_URL` changes and to using `.\scripts\dev.ps1`.
- Verified `.\scripts\release-check.ps1` on 2026-05-15 23:53 +08: 55 backend tests passed, deterministic evals passed, frontend typecheck/build passed, mock API smoke including PDF RAG passed, browser QA passed with screenshots under `.cache/qa/20260515-235325`, and dependency audit advisory remained tracked under TD-005.

## Robust Formula Rendering, RAG Schema Repair, And Visualization Planner Hardening

- Replaced the frontend math normalizer with a scanner-style Markdown/LaTeX normalization pass that protects code spans/fences, repairs mixed `$...$$` output, normalizes doubled LaTeX commands, wraps high-confidence bare formulas, and avoids false positives such as money-like dollar text.
- Added `npm run test:math` and wired it into `.\scripts\check.ps1` so formula rendering regressions are checked before frontend build and browser QA.
- Fixed the user's direct local PDF/RAG failure by adding a lightweight SQLite schema repair in `init_db()` for existing demo databases missing `documents.warnings_json`; this preserves local history instead of requiring manual DB deletion.
- Hardened the Agent prompt and planner around product capabilities: supported plot suggestions now tell the LLM the UI can generate previews, spatial-intuition requests trigger 3D when equations are available, previous-turn equations can be reused, and underspecified geometry asks for clarification without defaulting to `sin(x)/x`.
- Added plot expression normalization for common LaTeX/natural input forms, including root/power syntax, full-width equals, `z=` prefixes, simple implicit multiplication, and implicit equations with variables on the right side while retaining unsafe-expression rejection.
- Fixed local dev orchestration so `scripts/dev.ps1` calls `npm run dev:web-only`, avoiding recursive `npm run dev` when launched from `apps/web`; documented the new web-only and math-test commands.
- Verified `.\scripts\release-check.ps1` on 2026-05-16 12:22 +08: 64 backend tests passed, 18 deterministic evals passed, frontend typecheck passed, `npm run test:math` passed, frontend build passed, mock API smoke including PDF RAG passed, browser QA passed with screenshots under `.cache/qa/20260516-122246`, and dependency audit advisory remained tracked under TD-005.

## Real PDF RAG And OCR Plot Robustness Fix

- Fixed the RAG trigger gap where uploaded course materials were only used for explicit "根据课本/PDF" questions; course-topic questions such as "解释一下复合函数求导法则" now attempt retrieval when ready documents exist, and material overview questions such as "你能看到我上传的PDF吗" return real uploaded-document chunks instead of empty citations.
- Added a temporary-DB real PDF QA script, `scripts/qa_real_pdf_rag.py`, for user-provided local PDFs that should not be committed; it validates upload, page/chunk extraction, retrieval, chat citation metadata, and history metadata replay.
- Fixed the OCR/plot planner bug that treated surface-integral assignments like `I = \iint_\Sigma ...` as `implicit3d` equations; the planner now rejects integral assignments and prefers explicit geometry such as `z = \sqrt{1-x^2-y^2}` for a supported `surface3d` preview.
- Added plot-suggestion validation before metadata reaches the frontend and made truncated LaTeX roots such as `\sqrt{1` fail clearly instead of being auto-repaired into a misleading plot.
- Improved frontend PDF upload feedback, localized citation page labels, and replaced raw plot syntax errors with a user-level message that asks for a drawable function or surface expression.
- Expanded browser QA to cover implicit PDF overview questions and OCR-like surface-integral plotting without exposing `Expression is not valid syntax`.
- Verified `scripts/qa_real_pdf_rag.py` on 2026-05-16 with `C:\Users\Alami\Downloads\第13讲 复合函数求导法则(2).pdf`: upload produced 36 pages and 36 chunks; retrieval and chat citations referenced page 1 of the real PDF; session metadata persisted citations for history replay.
- Verified `.\scripts\release-check.ps1` on 2026-05-16 13:27 +08: 70 backend tests passed, 18 deterministic evals passed, frontend typecheck passed, `npm run test:math` passed, frontend build passed, mock API smoke passed, expanded browser QA passed with screenshots under `.cache/qa/20260516-132721`, and dependency audit advisory remained tracked under TD-005.

## Same-Session Plot, Latest-PDF RAG, And Source Timing Fix

- Fixed same-session plot reuse by making planner plot extraction prefer the current user turn before falling back to previous-turn equations; browser QA now covers two different surface plots in a single session.
- Fixed broad new-PDF RAG questions by resolving relative SQLite paths against `apps/api`, preferring recently updated ready documents, and routing material overview questions such as "给我讲解一下这个pdf" to real latest-document chunks.
- Delayed frontend source cards until the assistant answer is complete, so citations appear as answer attachments instead of before the response text.
- Hardened Plotly rendering lifecycle with stable plot keys, container purge/clear before new renders, stale-cleanup protection, scroll zoom/orbit drag, wider default camera, and explicit 3D axis ranges.
- Verified real PDF QA on `C:\Users\Alami\Downloads\邮雁智记 (1).pdf`: 27 pages, 12 chunks, broad "this pdf" chat citation to page 1, and persisted citation metadata.
- Verified real PDF QA on `C:\Users\Alami\Downloads\第13讲 复合函数求导法则(2).pdf`: 36 pages, 36 chunks, retrieval/chat citation to page 1, and persisted citation metadata.
- Verified `.\scripts\release-check.ps1` on 2026-05-16 14:33 +08: 74 backend tests passed, 18 deterministic evals passed, frontend typecheck passed, `npm run test:math` passed, frontend build passed, mock API smoke passed, expanded browser QA passed with screenshots under `.cache/qa/20260516-143333`, and dependency audit advisory remained tracked under TD-005.
