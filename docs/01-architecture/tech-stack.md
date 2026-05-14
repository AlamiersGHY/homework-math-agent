# 技术栈

本文档是 Math Agent MVP 的正式技术栈来源。根目录 `tech-stack.md` 是早期草稿，只能作为历史参考；如有冲突，以本文档和 ADR 为准。

## 选型原则

- 低学习成本：优先选择常见、稳定、AI Coding 友好的技术。
- 快速交付：优先让前后端尽快跑通，不提前引入重型平台能力。
- 可替换：LLM、OCR、Plot、Retrieval provider 必须通过抽象边界接入。
- 可验证：技术选型必须服务测试、eval 和部署，而不是只服务“看起来完整”。

## Frontend

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js App Router | 前端应用位于 `apps/web`。 |
| Language | TypeScript | 默认开启严格类型倾向，避免随意使用 `any`。 |
| Package manager | npm | MVP 默认使用 npm，避免额外工具链不确定性。 |
| Styling | Tailwind CSS | 第一版自建轻量组件，不引入 shadcn/ui。 |
| UI components | Local components | 聊天、OCR、Plot、数学渲染组件按 feature 拆分。 |
| LaTeX rendering | KaTeX / react-katex | 用于渲染 Agent 输出公式。 |
| Plot rendering | Plotly-style renderer | 第一版面向 Plotly 风格 spec，可在实现阶段选择合适 React 封装。 |
| State | React state first, optional Zustand | 简单局部状态优先；跨 feature 状态再使用 Zustand。 |
| HTTP | native `fetch` | 普通 JSON API 使用 `fetch`。 |
| SSE chat | `fetch` stream reader | `POST /chat/stream` 不能依赖原生 `EventSource`。 |
| Tests | Vitest / React Testing Library later | MVP 初期可先补 smoke/type/build 检查。 |

## Backend

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | FastAPI | 后端应用位于 `apps/api`。 |
| Language | Python 3.11+ | 使用 async/await 支持 IO 密集型 provider 调用。 |
| Environment | venv + pip | MVP 默认工具链，避免 uv 等额外依赖。 |
| Validation | Pydantic v2 | 请求、响应、SSE event、内部结构化数据都应建模。 |
| Tests | pytest + pytest-asyncio | 优先覆盖 service、API、SSE event shape。 |
| Persistence | SQLite | 用于轻量会话、消息、偏好、资源或调试数据。 |
| ORM | SQLAlchemy 2 lightweight | 可用简单 ORM 表；暂不启用 Alembic。 |
| Migrations | None for MVP | schema 明显扩大后再通过 ADR 决定是否引入 Alembic。 |
| Logging | Python logging | 记录 provider、耗时、失败原因，不记录密钥。 |

## Agent And Providers

| Area | Choice | Notes |
| --- | --- | --- |
| Orchestration | Explicit service pipeline | MVP 不使用 LangGraph。 |
| LLM | OpenAI-compatible provider interface | 具体供应商通过配置或 provider 实现替换。 |
| OCR | OCR provider interface | 可先 mock 或低成本 provider，后续替换 Mathpix 等专业服务。 |
| Plot | Plot service/provider | 后端生成或整理 Plotly 风格 spec，前端负责渲染。 |
| Retrieval | Lightweight retrieval provider | 仅作为可选增强，不做完整 RAG 平台。 |
| Evals | JSON cases under `evals/` | Agent 行为变更必须维护 eval cases。 |

## API And Streaming

- 聊天正式接口是 `POST /chat/stream`。
- 响应类型是 `text/event-stream`。
- 前端使用 `fetch` 发起 POST，并通过 `ReadableStream` 读取 SSE 文本。
- 不使用原生 `EventSource` 作为主方案，因为它不适合当前 POST 契约。
- 普通 JSON 接口继续使用 `fetch`。
- 如需 debug JSON endpoint，只能作为实现阶段辅助，不替代正式契约。

## Explicit Non-Choices For MVP

以下不是 MVP 默认技术栈：

- LangGraph。
- 完整 RAG / ChromaDB。
- shadcn/ui。
- pnpm / uv。
- Alembic。
- 原生 `EventSource` 作为 POST chat stream 客户端。
- 前端直连 LLM/OCR provider。

如需引入这些能力，必须更新相关 SDD 文档并通过 ADR 记录。
