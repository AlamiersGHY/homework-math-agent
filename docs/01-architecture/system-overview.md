# 系统概览

本文档定义 Math Agent MVP 的系统形态、服务边界和主要数据流。产品范围以 `docs/00-product/scope.md` 为准；目录规则以 `directory-rules.md` 为准；接口形态以 `api-contracts.md` 为准。

## 架构目标

MVP 架构服务三个目标：

- 快速交付可用学习闭环。
- 让 AI Coding 有明确模块边界，减少实现时的自由发挥。
- 保持外部能力可替换，例如 LLM、OCR、plot、retrieval provider。

本阶段不追求平台化、复杂账户系统、完整 RAG、长期记忆或重型 Agent 编排。

## 系统组成

```text
apps/web
  Next.js frontend
  chat UI / OCR upload / plot rendering / LaTeX rendering

apps/api
  FastAPI backend
  API routers / Pydantic schemas / services / providers / SQLite

evals
  agent behavior cases
  visualization trigger cases

docs
  SDD source of truth
```

### Frontend

`apps/web` 是用户交互层，计划使用 Next.js + TypeScript。

职责：

- 提供聊天界面和回答模式切换。
- 提供图片上传与 OCR 结果确认界面。
- 渲染 LaTeX 数学公式。
- 渲染 2D/3D plot spec。
- 消费后端 SSE 聊天流。

前端不直接调用 LLM、OCR 或绘图 provider。所有外部能力必须通过后端 API。

### Backend

`apps/api` 是业务与 provider 编排层，计划使用 FastAPI + Pydantic。

职责：

- 定义 API contracts。
- 执行 Agent service pipeline。
- 调用 LLM/OCR/plot/retrieval providers。
- 管理轻量 SQLite 持久化。
- 产出可测试、可 eval 的结构化行为。

后端 route handler 只负责请求解析、调用 service 和响应转换；业务逻辑不得堆在 route handler 中。

### SQLite

SQLite 是 MVP 可用的轻量持久化方案，可用于：

- 会话与消息的基础记录。
- 用户本地风格/回答模式偏好。
- 少量知识条目、例题或配置。
- provider 调用日志或调试记录。

SQLite 不代表本阶段要实现登录、长期个人账户或完整知识库。若 schema 明显扩大，再引入迁移流程。

### Providers

外部能力通过 provider 抽象接入：

- LLM provider：回答生成、分类、结构化判断。
- OCR provider：图片到可编辑文本。
- Plot provider/service：表达式和范围到 plot spec。
- Retrieval provider：轻量课程资料或知识条目检索。

Provider 不应写死在 UI、route handler 或核心 prompt 中。MVP 可以先使用 mock provider 或低成本 provider 跑通链路。

## Agent Pipeline

MVP 使用显式 service pipeline，不使用 LangGraph 或重型多 Agent 编排。

推荐流程：

```text
input
-> normalize request
-> classify question
-> resolve answer mode
-> optional retrieve context
-> optional decide visualization
-> stream answer from LLM provider
-> emit metadata / plot suggestion / final event
-> persist lightweight session state if enabled
```

这条 pipeline 应保持普通 Python service 可读、可测试。只有当分支、状态回退和工具调用复杂到 service pipeline 难以维护时，才通过 ADR 重新评估 LangGraph。

## 核心数据流

### 1. 文本聊天

```text
Web chat form
-> POST /chat/stream
-> Chat service pipeline
-> LLM provider streaming
-> SSE events
-> Web message rendering
```

聊天主接口使用 SSE 流式输出。前端应能处理增量文本、元数据、错误和结束事件。

### 2. OCR 输入

```text
Web image upload
-> POST /ocr/recognize
-> OCR service
-> OCR provider
-> recognized editable text
-> user confirms text
-> POST /chat/stream
```

OCR 结果必须先给用户编辑或确认，不应自动直接进入解题。

### 3. 可视化生成

```text
Question or expression
-> POST /plots/preview
-> Plot service
-> expression/range validation
-> plot spec
-> Web plot renderer
```

第一版优先支持 Plotly 风格 spec，覆盖 2D 函数图和 `z = f(x, y)` 曲面。

### 4. 轻量检索

```text
Question
-> Retrieval service
-> local structured entries or keyword search
-> context snippets
-> Chat service prompt context
```

检索是增强能力。检索失败时不得阻塞基础回答，也不得编造来源。

## 明确不做

MVP 架构不包含：

- LangGraph 或重型 Agent graph。
- 完整 RAG 平台。
- 用户注册、登录、权限体系。
- 长期跨设备账户数据。
- 大规模题库系统。
- 前端直连外部 LLM/OCR provider。

这些能力如需加入，必须先更新 `scope.md` 并记录 ADR。
