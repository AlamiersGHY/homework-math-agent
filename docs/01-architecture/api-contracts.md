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
- `unknown`：无法明确判断。

### PlotType

- `function2d`：二维函数图。
- `surface3d`：三维曲面图。
- `region2d`：二维区域图。

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
  "context": {
    "previous_turns": [],
    "style": "default"
  }
}
```

字段说明：

- `message`：用户当前输入，必填。
- `answer_mode`：`direct`、`guided` 或 `hint`，必填；前端应显式传入当前选择。
- `session_id`：可选；后端可用于轻量会话记录。
- `confirmed_ocr_text`：可选；当用户从 OCR 结果确认后发起聊天时使用。
- `context`：可选；用于传递前端当前上下文，不承载长期记忆。

响应：`text/event-stream`

SSE 事件：

```text
event: start
data: {"session_id":"...","answer_mode":"guided"}

event: metadata
data: {"question_type":"computational","should_visualize":false}

event: delta
data: {"text":"先观察这个极限..."}

event: metadata
data: {"plot_suggestion":null}

event: done
data: {"finish_reason":"stop"}
```

错误事件：

```text
event: error
data: {"code":"llm_provider_error","message":"LLM provider failed","details":{}}
```

约定：

- `delta` 可以出现多次。
- `metadata` 可以在流开始或结束前出现多次。
- 如果需要可视化，`metadata.plot_suggestion` 可给出 plot preview 的建议参数，但真正图形生成走 `/plots/preview`。
- 实现阶段可保留普通 JSON debug endpoint，但正式聊天契约以 SSE 为主。

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

- `recognized_text` 是前端展示和用户编辑的默认文本。
- `confidence` 可为空或为 provider 估计值。
- `warnings` 用于提示识别不确定、公式可能缺失等问题。
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
  "source": "user_or_agent"
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
- 后端应对表达式解析失败、范围不合法、采样失败给出结构化错误。

## 后续可选接口

以下接口不属于第一版必需契约，后续做轻量 RAG 或题库时再补充：

- `POST /retrieval/search`
- `GET /examples`
- `GET /knowledge/{id}`

在没有更新 `scope.md` 和本文档前，不应实现完整 RAG 平台或个人知识库接口。
