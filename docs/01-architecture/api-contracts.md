# API 契约

本文档定义 MVP 第一版后端接口。接口实现应优先满足这里的契约；如需变更路径、字段或事件语义，应同步更新本文档。

## 通用约定

- 后端应用：`apps/api`。
- 前端应用：`apps/web`。
- 普通接口使用 JSON。
- 聊天主接口使用 SSE 流式响应。
- 请求和响应 schema 使用 Pydantic 定义。
- 错误响应使用统一结构；SSE 内错误使用 `error` event。

## 通用枚举

### AnswerMode

- `direct`：直接解答。
- `guided`：分步引导。
- `hint`：仅提示。

### QuestionType

- `conceptual`：概念类。
- `computational`：计算类。
- `proof`：证明类。
- `visualization`：可视化类。
- `mixed`：混合型问题，可能同时需要证明、计算、检索或可视化。
- `ocr_derived`：由用户确认后的 OCR 文本形成的问题。
- `off_topic`：明显偏离数学学习助手范围的问题。
- `unknown`：无法明确判断。

### PlotType

- `function2d`：二维函数图。
- `surface3d`：三维曲面图。
- `region2d`：二维区域图。
- `implicit3d`：受支持的三维隐式曲面预览。

## 错误格式

普通 JSON 接口错误响应：

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

约定：

- `code` 面向程序判断。
- `message` 面向用户或开发调试。
- `details` 可为空对象。

## GET /health

用途：健康检查和部署探活。

响应：

```json
{
  "status": "ok",
  "service": "math-agent-api",
  "version": "0.1.0"
}
```

## POST /chat/stream

用途：聊天主接口。接收用户问题和回答模式，通过 SSE 返回增量回答和元数据。

请求 JSON：

```json
{
  "message": "求 lim(x->0) sin(x)/x",
  "answer_mode": "guided",
  "session_id": "optional-session-id",
  "confirmed_ocr_text": null,
  "attachments": [
    {
      "id": "image-...",
      "kind": "image",
      "file_name": "problem.png",
      "preview_data_url": "data:image/png;base64,...",
      "annotated": false
    }
  ],
  "context": {
    "previous_turns": [],
    "style": "default",
    "soul": null
  }
}
```

字段说明：

- `message`：用户当前输入，必填。
- `answer_mode`：`direct`、`guided` 或 `hint`，必填；前端应显式传入当前选择。
- `session_id`：可选；后端可用于轻量会话记录。
- `confirmed_ocr_text`：可选；当用户从 OCR 结果确认后发起聊天时使用。
- `attachments`：可选；用于保存用户可见的图片附件快照。OCR 文本仍通过 `confirmed_ocr_text` 作为隐藏推理输入，不能替代用户可见的 `message`。
- `context`：可选；用于传递前端当前上下文，不承载长期记忆。
- `context.style`：可选；当前轮全局回答风格，取值为 `default`、`playful`、`strict` 或 `custom`。
- `context.soul`：可选；当前轮全局自定义风格补充，长度应由前端和后端共同限制。

响应：`text/event-stream`

SSE 事件：

```text
event: start
data: {"session_id":"...","answer_mode":"guided","user_message_id":"msg-..."}

event: metadata
data: {"question_type":"computational","should_visualize":false,"planner":{...},"quick_replies":["第一步为什么要想到标准极限？","能用夹逼定理引导我吗？","如果换成 sin(3x)/x 怎么办？"]}

event: delta
data: {"text":"先观察这个极限..."}

event: metadata
data: {"plot_suggestion":null}

event: done
data: {"finish_reason":"stop","assistant_message_id":"msg-..."}
```

错误事件：

```text
event: error
data: {"code":"llm_provider_error","message":"LLM provider failed","details":{}}
```

约定：

- `delta` 可以出现多次。
- `metadata` 可以在流开始或结束前出现多次。
- `user_message_id` 和 `assistant_message_id` 是本地持久化消息 ID，前端只把它们当作 opaque id，用于把临时消息替换成可恢复的历史消息，并关联后续 plot artifact。
- `planner` 是可选的结构化 agent policy plan。它是 additive metadata；现有 `question_type`、`should_visualize`、`plot_suggestion` 顶层字段必须继续保留，避免破坏前端兼容。
- `quick_replies` 是 guided 模式下给用户的 3 个快捷下一步建议；direct/hint 模式应为空数组。建议内容应贴合当前题目，优先表现为用户下一轮可能点击发送的苏格拉底式追问，而不是泛化的“给我提示/继续”按钮。
- 如果需要可视化，`metadata.plot_suggestion` 可给出 plot preview 的建议参数，但真正图形生成走 `/plots/preview`。
- 实现阶段可保留普通 JSON debug endpoint，但正式聊天契约以 SSE 为主。

### Planner Metadata

Phase 1 planner metadata 形态：

```json
{
  "question_type": "visualization",
  "needs_retrieval": true,
  "needs_plot": true,
  "needs_clarification": false,
  "answer_mode": "guided",
  "retrieval_scope": "uploaded_course_materials",
  "plot_type": "surface3d",
  "memory_action": "none",
  "style_config": {
    "style": "default",
    "soul": null
  },
  "reason": "The question asks about a surface and may benefit from course context."
}
```

约定：

- Planner 输出必须可由 Pydantic schema 验证。
- Planner 失败时必须有 deterministic fallback，不得中断 chat stream。
- `reason` 面向开发和简短 agent-decision hints，不应暴露 provider 或调试细节。
- `needs_retrieval=true` 不代表当前一定有资料可引用；后续 retrieval 阶段必须避免伪造 citation。

## GET /sessions

用途：列出本地 SQLite 保存的最近学习会话。

响应 JSON：

```json
[
  {
    "id": "session-...",
    "title": "求 lim(x->0) sin(x)/x",
    "default_answer_mode": "guided",
    "created_at": "2026-05-15T00:00:00Z",
    "updated_at": "2026-05-15T00:00:00Z"
  }
]
```

## GET /sessions/{session_id}

用途：读取单个本地学习会话，包含消息和可恢复 artifacts。

响应 JSON：

```json
{
  "session": {
    "id": "session-...",
    "title": "画一下 z = sin(x*y) 的三维曲面",
    "default_answer_mode": "direct",
    "created_at": "2026-05-15T00:00:00Z",
    "updated_at": "2026-05-15T00:00:00Z"
  },
  "messages": [],
  "artifacts": [
    {
      "id": "artifact-...",
      "artifact_type": "plot_preview",
      "payload": {
        "request": {},
        "plot": {}
      },
      "message_id": "msg-...",
      "created_at": "2026-05-15T00:00:00Z"
    }
  ]
}
```

约定：

- `messages` 应返回该会话的完整本地消息历史，按 `created_at` 升序排列；不得用固定 50 条截断作为默认详情行为。
- `artifacts` 应按 `created_at` 升序返回，便于前端稳定恢复历史状态。
- `artifact_type="chat_metadata"` 可保存该 assistant message 对应的 planner 元数据、题型、可视化意图等恢复信息。
- `artifact_type="message_attachments"` 可保存用户消息的图片附件快照，`message_id` 应指向对应 user message；前端历史恢复时用它还原附件卡片，不能把隐藏 OCR 文本作为用户可见消息。
- `artifact_type="plot_suggestion"` 可保存 planner 给出的可视化建议；当前前端会在 assistant 回答完成后自动调用 `/plots/preview`，历史恢复时若没有对应 `plot_preview` 仍可展示生成入口。
- `artifact_type="plot_preview"` 保存已生成图形，`message_id` 应优先指向对应 assistant message；前端可对旧的无 `message_id` artifacts 做兼容恢复，但新写入不应依赖无绑定状态。

## DELETE /sessions/{session_id}

用途：删除本地 SQLite 会话及其 messages/artifacts。

响应：

- `204 No Content`：删除成功。
- `404`：会话不存在。

## POST /ocr/recognize

用途：识别图片中的题目或推导，返回可编辑文本。OCR 结果不自动进入聊天，必须由用户确认。

请求：`multipart/form-data`

字段：

- `file`：图片文件，必填。
- `provider`：可选 OCR provider 名称；默认由后端配置决定。

响应 JSON：

```json
{
  "recognized_text": "求 lim_{x\\to 0} \\frac{\\sin x}{x}",
  "confidence": 0.82,
  "provider": "mock-or-configured-provider",
  "warnings": []
}
```

约定：

- `recognized_text` 是 OCR 识别结果。当前聊天式附件 UX 不把该文本直接塞进 textarea；前端在用户发送时把它作为隐藏的 `confirmed_ocr_text` 传给 chat。
- `confidence` 可为空或为 provider 估计值。
- `warnings` 用于提示识别不确定、公式可能缺失等问题。
- 前端不得在用户可见输入框中暴露未确认的 OCR 中间文本；OCR 可以在发送前或发送时执行，但必须由用户显式发送后才进入 `POST /chat/stream`。
- OCR 失败时返回统一错误 JSON。

## POST /plots/preview

用途：根据表达式、范围和图形类型生成前端可渲染的 plot spec。

请求 JSON：

```json
{
  "plot_type": "surface3d",
  "expression": "sin(x*y)",
  "variables": ["x", "y"],
  "ranges": {
    "x": [-3, 3],
    "y": [-3, 3]
  },
  "source": "user_or_agent",
  "session_id": "optional-session-id",
  "message_id": "optional-assistant-message-id"
}
```

响应 JSON：

```json
{
  "plot_type": "surface3d",
  "renderer": "plotly",
  "spec": {
    "data": [],
    "layout": {}
  },
  "explanation": "该图展示 z = sin(xy) 在给定区域内的起伏。"
}
```

约定：

- 第一版优先返回 Plotly 风格 spec。
- `function2d` 至少需要一个变量和一个范围。
- `surface3d` 至少需要两个变量和两个范围。
- `implicit3d` 至少需要 `x`、`y`、`z` 三个变量、三个有限范围，以及单个等式表达式，例如 `x^4 + y^4 + z^4 = 1`；后端返回 Plotly `isosurface` spec。实现应对等式生成残差场 `F(x,y,z)-level`，并使用包含 0 的非零 `isomin/isomax` 窄区间，避免 `isomin == isomax` 导致前端 Plotly/WebGL 无法稳定渲染。
- 当 `session_id` 对应本地会话存在时，后端会把 plot preview 作为 `plot_preview` artifact 保存到该会话；`message_id` 用于把图形关联到对应 assistant message。
- 当请求包含 `session_id` 但该会话不存在时，接口应返回统一错误 JSON，例如 `404` / `session_not_found`，不能静默返回一个看似已保存的结果。
- 前端恢复历史会话时应优先使用 session detail 中的 `plot_preview` artifact，而不是重新推导数学表达式。
- 后端应对表达式解析失败、范围不合法、采样失败给出结构化错误。

## POST /documents/upload

用途：上传本地课程 PDF，提取文本并保存 page-aware chunks，供后续检索使用。

请求：`multipart/form-data`

字段：

- `file`：PDF 文件，必填。

响应 JSON：

```json
{
  "document": {
    "id": "doc-...",
    "filename": "Analysis Notes.pdf",
    "content_type": "application/pdf",
    "status": "ready",
    "page_count": 12,
    "chunk_count": 34,
    "warnings": [],
    "error_message": null,
    "created_at": "2026-05-15T00:00:00Z",
    "updated_at": "2026-05-15T00:00:00Z"
  }
}
```

约定：

- v1 只接受 PDF；非 PDF 返回 `400 document_validation_error`。
- PDF 解析通过 document parser provider 边界完成，route handler 不直接调用 PyMuPDF。
- chunk 必须保留真实 `filename`、`page_start`、`page_end`、`section_title`、`chunk_index` 等可引用元数据。
- 无可提取文本的 PDF 不应伪造 OCR 文本；应返回明确 `failed` 状态或 warnings。
- 重复上传同一文件 hash 时可以返回已有 document summary，避免重复 chunk。

## GET /documents

用途：列出本地已上传课程材料。

响应：`DocumentSummary[]`，字段同上传响应中的 `document`。

## DELETE /documents/{document_id}

用途：删除本地课程材料及其 chunks。

响应：

- `204 No Content`：删除成功。
- `404 document_not_found`：文档不存在。

## POST /retrieval/search

用途：对本地上传材料执行 citation-safe 检索。

请求 JSON：

```json
{
  "query": "uniform continuity definition",
  "top_k": 5
}
```

响应 JSON：

```json
{
  "query": "uniform continuity definition",
  "results": [
    {
      "source_index": 1,
      "score": 0.42,
      "chunk_id": "chunk-...",
      "document_id": "doc-...",
      "filename": "Analysis Notes.pdf",
      "page_start": 4,
      "page_end": 5,
      "section_title": "Uniform Continuity",
      "snippet": "..."
    }
  ]
}
```

约定：

- v1 使用本地 deterministic lexical retrieval；不要求远程 embedding 或向量库。
- 空库、低相关或检索失败不得伪造来源；应返回空 `results` 或明确 metadata 状态。
- 前端 citation/source display 只能渲染后端返回的结构化来源，不得从自然语言回答中合成页码、文件名或章节。

## 后续可选接口

以下接口不属于当前必需契约，后续做偏好、记忆或题库时再补充：

- `POST /documents/{id}/reindex`
- `GET /profile`
- `POST /profile`
- `GET /examples`
- `GET /knowledge/{id}`

在没有更新 `scope.md` 和本文档前，不应实现完整 RAG 平台或个人知识库接口。
