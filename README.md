# Math Agent

## 中文

Math Agent 是一个面向数学分析学习场景的实验性 AI Coding 项目。目标是在较短周期内构建一个可交付的数学学习助手，同时探索轻量 SDD / Harness 风格的 AI Coding 工作流。

当前项目已经完成 SDD 基座和第一版可运行工程骨架：

- `apps/web`: Next.js + TypeScript + Tailwind 前端骨架。
- `apps/api`: FastAPI + Pydantic 后端骨架。
- `GET /health`: 已实现并通过测试。
- `POST /chat/stream`: 已实现 mock SSE 流式接口。
- `evals/`: 已有首批 Agent 行为和可视化触发样例。
- 本地 Git 仓库已初始化，暂未连接 GitHub 远程。

### 项目目标

- 构建一个面向工科本科生的数学分析学习助手。
- 支持直接解答、分步引导、仅提示、概念讲解、计算辅助、证明辅助等学习场景。
- 逐步接入 OCR、LaTeX 渲染、函数或积分区域可视化、轻量课程资料检索等能力。
- 用轻量 SDD 文档、eval cases 和自动化脚本减少开发过程中的人工介入。

### 本地运行

后端：

```powershell
cd apps/api
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
$env:PYTHONPATH = "src"
.\.venv\Scripts\python -m uvicorn math_agent_api.main:app --reload
```

后端测试：

```powershell
cd apps/api
.\.venv\Scripts\python -m pytest
```

前端：

```powershell
cd apps/web
npm install
npm run dev
```

前端构建：

```powershell
cd apps/web
npm run build
```

### 目录结构

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

### 开发入口

非平凡任务应先阅读：

1. [AGENTS.md](AGENTS.md)
2. [docs/INDEX.md](docs/INDEX.md)
3. [docs/04-logs/active.md](docs/04-logs/active.md)

正式产品范围、架构、API 契约、编码规范和测试策略以 `docs/` 中的 SDD 文档为准。根目录的 `product_requirments.md` 和 `tech-stack.md` 是早期规划草稿，不作为最终 source of truth。

## English

Math Agent is an experimental AI Coding project for mathematical analysis learning. The goal is to build a useful learning assistant in a short development cycle while exploring a lightweight SDD / Harness-style workflow for AI-assisted software development.

The project now has a runnable scaffold:

- `apps/web`: Next.js + TypeScript + Tailwind frontend scaffold.
- `apps/api`: FastAPI + Pydantic backend scaffold.
- `GET /health`: implemented and tested.
- `POST /chat/stream`: mock SSE streaming endpoint implemented.
- `evals/`: initial Agent behavior and visualization trigger cases.
- Local Git repository initialized, with no GitHub remote connected yet.

### Goals

- Build a mathematical analysis learning assistant for undergraduate engineering students.
- Support direct answers, guided hints, concept explanations, calculation assistance, and proof assistance.
- Gradually add OCR, LaTeX rendering, function or integration-region visualization, and lightweight course-material retrieval.
- Use lightweight SDD documents, eval cases, and automation scripts to reduce manual intervention during development.

### Local Development

Backend:

```powershell
cd apps/api
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
$env:PYTHONPATH = "src"
.\.venv\Scripts\python -m uvicorn math_agent_api.main:app --reload
```

Backend tests:

```powershell
cd apps/api
.\.venv\Scripts\python -m pytest
```

Frontend:

```powershell
cd apps/web
npm install
npm run dev
```

Frontend build:

```powershell
cd apps/web
npm run build
```

### Development Workflow

For non-trivial work, read:

1. [AGENTS.md](AGENTS.md)
2. [docs/INDEX.md](docs/INDEX.md)
3. [docs/04-logs/active.md](docs/04-logs/active.md)

Product scope, architecture, API contracts, coding standards, and testing strategy should follow the SDD documents under `docs/`. The root-level `product_requirments.md` and `tech-stack.md` files are early planning drafts, not the final source of truth.
