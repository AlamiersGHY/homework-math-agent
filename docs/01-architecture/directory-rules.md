# 目录规则

本文档是项目文件放置规则的来源。除非后续 ADR 明确修改，不使用根目录单一 `src/` 存放所有实现代码。

## 项目级目录

- `apps/web/`：前端应用。
- `apps/api/`：后端应用。
- `docs/`：SDD 文档。
- `evals/`：Agent 行为和产品行为评估样例。
- `references/`：外部参考、课程材料、调研资料。
- `scripts/`：可重复执行的自动化脚本。
- `tests/`：跨应用或端到端测试。

## 前端目录

前端代码放在 `apps/web/`。计划使用 Next.js，因此应用源码应放在 `apps/web/src/` 下。

推荐结构：

```text
apps/web/
  src/
    app/              # Next.js App Router routes and layouts
    components/       # reusable UI components
    features/         # feature modules: chat, ocr, plots, settings
    lib/
      api/            # backend API clients and SSE helpers
      math/           # frontend math rendering helpers if needed
    stores/           # client state such as answer mode or session state
    styles/           # global styles when needed
    types/            # shared frontend TypeScript types
```

规则：

- API 调用集中在 `lib/api/`，不要散落在组件里。
- 聊天、OCR、plot 等产品能力优先放在 `features/` 下组织。
- LaTeX 渲染和 plot 渲染应是独立组件，避免写进聊天消息组件内部。
- 前端不直接调用 LLM、OCR、plot provider。

## 后端目录

后端代码放在 `apps/api/`。计划使用 FastAPI，因此应用源码应放在 `apps/api/src/` 下。

推荐结构：

```text
apps/api/
  src/
    math_agent_api/
      main.py          # FastAPI app factory or app entry
      routers/         # route handlers
      schemas/         # Pydantic request/response/event models
      services/        # business logic and pipelines
      providers/       # external provider adapters
      prompts/         # prompt templates and prompt assembly
      data/            # small local knowledge entries or examples
      db/              # SQLite connection, models, repositories
      core/            # config, logging, errors
  tests/               # backend unit/API tests
```

规则：

- `routers/` 只做 HTTP/SSE 边界，不放复杂业务逻辑。
- `schemas/` 定义 Pydantic models，作为 API 和 service 的结构化边界。
- `services/` 放 Agent pipeline、OCR workflow、plot workflow、retrieval workflow。
- `providers/` 封装 LLM、OCR、plot、retrieval 等外部能力。
- `prompts/` 放 prompt 模板和组装逻辑，不把 prompt 大段硬编码在 route 中。
- `db/` 只处理持久化细节，不承载业务决策。
- `tests/` 优先覆盖 service 和 API 行为。

## Evals

`evals/` 存放行为评估样例，不替代单元测试。

推荐用途：

- `agent_cases.json`：题型分类、回答模式、提示策略、禁止行为。
- `visual_cases.json`：是否触发可视化、plot 类型、表达式/范围预期。

实现阶段可以为 evals 增加 runner，但 eval case 本身应保持人类可读。

## References

`references/` 只放外部原始资料，例如课程 PDF、截图、API 调研笔记和设计参考。

如果某条信息变成项目决策或产品范围，必须沉淀到 `docs/`，不要只留在 `references/`。

## Scripts

`scripts/` 放可重复执行的自动化入口，例如：

- 启动前后端。
- 运行测试。
- 运行 evals。
- 检查文档或格式。

脚本应避免隐藏重要决策；重要行为仍应记录在 `docs/`。

## 禁止事项

- 不在根目录创建新的通用 `src/` 来混放前后端代码。
- 不把 provider 调用写进 UI component。
- 不把业务 pipeline 写进 FastAPI route handler。
- 不把产品范围只写在 README 或聊天记录里。
