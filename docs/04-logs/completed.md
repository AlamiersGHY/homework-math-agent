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
