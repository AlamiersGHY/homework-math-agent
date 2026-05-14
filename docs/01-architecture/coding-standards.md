# 编码规范

本文档定义 MVP 阶段的技术栈编码规则。正式技术栈以 `tech-stack.md` 为准；系统边界以 `system-overview.md`、`directory-rules.md` 和 `api-contracts.md` 为准。

## 通用原则

- 先实现可运行闭环，再抽象通用框架。
- 代码必须遵守 UI、API、service、provider、db 的层次边界。
- 不引入当前范围外的依赖。
- 不把外部 provider 写死在 UI component、route handler 或 prompt 中。
- 修改 API、目录、技术栈、测试策略或 durable decisions 时，同步更新 SDD 文档或 ADR。

## Next.js 编码规则

- 使用 App Router。
- 页面和 layout 放在 `apps/web/src/app/`。
- 可复用 UI 放在 `apps/web/src/components/`。
- 聊天、OCR、Plot、设置等按 feature 放在 `apps/web/src/features/`。
- API client 和 SSE helper 放在 `apps/web/src/lib/api/`。
- 共享类型放在 `apps/web/src/types/`。
- 默认使用 Server Component；需要浏览器状态、事件、SSE、Plotly、文件上传或 local UI state 时才使用 Client Component。
- Client Component 应尽量小，不把整页都标记为 client。

## TypeScript 规则

- API 请求、响应、SSE event 和 plot spec 必须有类型。
- 避免使用 `any`；确实无法建模时用 `unknown` 后显式收窄。
- 前端类型语义应与 `api-contracts.md` 对齐。
- 跨 feature 共享类型放在 `src/types/`；仅 feature 内部使用的类型靠近 feature。
- 不在多个文件中重复定义同一个 API 类型。

## Frontend API And SSE

- 普通 JSON 接口使用 native `fetch`。
- `POST /chat/stream` 使用 `fetch` + `ReadableStream` 读取 SSE 文本。
- 不使用原生 `EventSource` 作为聊天主实现，因为正式契约是 POST。
- SSE 解析逻辑应封装为 helper 或 hook，不散落在 UI 组件中。
- API base URL 只在集中配置或 API client 中读取，不在组件里拼接。
- SSE helper 至少要处理 `start`、`metadata`、`delta`、`error`、`done` 事件。

## Tailwind And UI

- MVP 使用 Tailwind 自建轻量组件。
- 不引入 shadcn/ui，除非后续 ADR 明确批准。
- 重复控件应抽成 local component，例如 button、input、textarea、mode selector。
- 聊天消息、OCR 编辑区、Plot viewer、数学内容渲染应拆成独立组件。
- 样式应优先清晰和稳定，避免为了装饰引入复杂布局。
- 数学公式和按钮文本必须避免明显溢出。

## Math And Plot Components

- LaTeX 渲染封装为独立数学内容组件。
- Plot 渲染封装为独立 Plot viewer。
- Plot viewer 应作为 Client Component。
- Plot viewer 接收后端返回的 plot spec，不在组件内重新推导数学表达式。
- 如果 plot library 需要动态导入，应封装在 Plot viewer 内部，避免污染普通页面渲染。

## FastAPI 编码规则

- Route handler 只处理 HTTP/SSE 边界。
- Pydantic schemas 定义请求、响应、SSE event 和内部结构化数据。
- Service 层承载业务流程，例如 chat pipeline、OCR workflow、plot workflow。
- Provider 层封装外部调用，例如 LLM、OCR、retrieval、plot backend。
- Repository 或 db 层只处理持久化，不做产品策略判断。
- Prompt 模板和组装逻辑放在 `prompts/` 或 prompt service 中。
- 错误应转换为统一结构，不向前端泄露 provider 原始异常。
- 日志记录 provider 名称、耗时、失败原因；不要记录 API key 或敏感原文。

## Pydantic And Schemas

- API contract 中的请求/响应都应有对应 Pydantic model。
- 枚举值应与 `api-contracts.md` 一致，例如 `AnswerMode`、`QuestionType`、`PlotType`。
- SSE event data 也应尽量使用 Pydantic model 生成。
- LLM 输出若需要结构化解析，必须先进入 Pydantic 校验再进入业务逻辑。

## SQLite And SQLAlchemy

- MVP 允许 SQLite + SQLAlchemy 2 轻量使用。
- 第一版可建简单表用于 session、message、preference、resource 或 debug log。
- 暂不启用 Alembic。
- 不为登录、权限、长期用户系统提前建模。
- 若 schema 变复杂或需要迁移历史数据，再通过 ADR 决定是否引入 Alembic。
- db 层不决定回答模式、题型策略或 provider 选择。

## Agent Pipeline

MVP 使用普通 service pipeline，不使用 LangGraph。

推荐拆分：

- question classification
- answer mode resolution
- optional retrieval
- visualization decision
- LLM streaming
- SSE event mapping
- lightweight persistence

若后续需要 LangGraph，必须先更新 `scope.md` 并新增 ADR。

## Provider 抽象

所有外部能力都应可替换。

最少保留这些边界：

- `LLMProvider`
- `OCRProvider`
- `PlotService` 或 `PlotProvider`
- `RetrievalProvider`

MVP 可以使用 mock provider 跑通测试和 UI，不要求第一天接入最终供应商。

## 测试编码规则

- 后端优先写 pytest。
- API tests 应覆盖请求、响应和错误结构。
- SSE tests 应覆盖 event shape，而不只检查 HTTP 200。
- Plot service tests 应覆盖 expression/range validation 和 plot spec shape。
- Agent 行为进入 `evals/`；修改回答策略前先更新 eval case。
- 前端在 scaffold 后至少应能运行类型检查或 build。

## 文档同步

以下变化必须同步文档：

- 技术栈变化：更新 `tech-stack.md` 和 ADR。
- API path、字段或事件变化：更新 `api-contracts.md`。
- 目录结构变化：更新 `directory-rules.md`。
- 架构边界变化：更新 `system-overview.md`。
- 长期技术决策：新增或更新 ADR。
- Agent 行为变化：更新 `evals/`。
