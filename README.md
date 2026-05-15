# Math Agent

Math Agent is a local MVP demo for a mathematical analysis learning assistant. The current product is no longer just a scaffold: it provides a usable learning workspace with streaming chat, answer-mode control, local session history, OCR confirmation, and Plotly-based visualization.

## Current MVP

- `apps/web`: Next.js + TypeScript + Tailwind learning workspace.
- `apps/api`: FastAPI + Pydantic backend with thin routers and service/provider boundaries.
- Streaming chat through `POST /chat/stream`.
- Answer modes: direct answer, guided explanation, and hint-only.
- Local SQLite-backed sessions through `GET /sessions` and `GET /sessions/{session_id}`.
- Local PDF material upload, lexical retrieval, and citation-safe source cards through the document and retrieval APIs.
- OCR upload flow through `POST /ocr/recognize`; mock is test-safe, Doubao Vision is the preferred live MVP provider, Mathpix is reserved for a future adapter.
- Plot preview through `POST /plots/preview` for `function2d`, `surface3d`, bounded `region2d`, and MVP `implicit3d` specs rendered by Plotly in the frontend.
- Deterministic evals for classification and visualization behavior.

Out of current demo scope: a full RAG platform, LangGraph/runtime multi-agent orchestration, login/accounts, cross-device sync, and professional implicit-surface modeling.

## Quick Start

Install backend dependencies:

```powershell
cd apps/api
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
```

Install frontend dependencies:

```powershell
cd apps/web
npm install
```

Start the local demo from the repository root:

```powershell
.\scripts\dev.ps1
```

Default URLs:

- API: `http://127.0.0.1:8000`
- Web: `http://127.0.0.1:3000`

The root `dev.ps1` entry injects the frontend API base URL automatically. If you start
`apps/web` directly, copy `apps/web/.env.example` to `apps/web/.env.local` or set:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

PDF material upload/RAG does not require a separate provider key; it uses the same local
FastAPI API and SQLite database.

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env` for local provider configuration. `.env` files are ignored by Git.

For mock-safe local development:

```env
LLM_PROVIDER=mock
OCR_PROVIDER=mock
DATABASE_URL=sqlite:///math_agent.db
```

For the current real LLM path, use the OpenAI-compatible settings documented in `apps/api/.env.example`. Live OCR requires:

```env
OCR_PROVIDER=doubao_vision
DOUBAO_API_KEY=your_volcengine_ark_api_key
DOUBAO_VISION_MODEL=your_vision_model_or_endpoint_id
```

Do not commit real API keys or paste them into SDD logs.

## Verification

From the repository root:

```powershell
.\scripts\test.ps1
.\scripts\eval.ps1
.\scripts\check.ps1
.\scripts\browser-qa.ps1
.\scripts\release-check.ps1
```

What they cover:

- `test.ps1`: backend pytest.
- `eval.ps1`: deterministic agent/visualization eval runner.
- `check.ps1`: backend tests, evals, frontend typecheck, and frontend build.
- `browser-qa.ps1`: production-build browser QA against mock API/OCR for desktop and mobile.
- `release-check.ps1`: full check, mock API smoke, browser QA, and frontend dependency audit advisory.

The release check intentionally treats the current `npm audit --omit=dev` moderate findings as advisory unless `-StrictAudit` is passed; the risk is tracked in `docs/04-logs/tech-debt-tracker.md`.

When local real LLM credentials are configured, add `-LiveLLM`:

```powershell
.\scripts\release-check.ps1 -LiveLLM
```

## Project Structure

```text
.
|-- AGENTS.md
|-- README.md
|-- apps/
|   |-- api/
|   `-- web/
|-- docs/
|   |-- INDEX.md
|   |-- 00-product/
|   |-- 01-architecture/
|   |-- 02-workflow/
|   |-- 03-decisions/
|   `-- 04-logs/
|-- evals/
|-- references/
|-- scripts/
`-- tests/
```

## SDD Workflow

For non-trivial work, read:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/04-logs/active.md`

Product scope, architecture, API contracts, coding standards, testing strategy, and current status live in `docs/`. Root-level early planning drafts are reference material only and are not the source of truth.

## 中文说明

Math Agent 当前是一个本地可演示 MVP：前端是数学分析学习工作台，后端提供流式对话、轻量会话历史、OCR 确认链路、PDF 材料检索引用和 Plotly 图形预览。当前版本不做完整 RAG 平台、不做登录账户、不引入 LangGraph 或运行时多 Agent 编排。

常用入口：

```powershell
.\scripts\dev.ps1
.\scripts\release-check.ps1
```

真实 LLM 和 Doubao OCR 的密钥只放在 `apps/api/.env`，不要提交到 Git。
