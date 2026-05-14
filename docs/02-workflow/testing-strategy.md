# 测试策略

本文档定义 Math Agent 如何验证确定性代码和 Agent 行为。测试目标不是追求一开始覆盖率很高，而是为 AI Coding 提供可靠的边界检查。

## 测试层级

### 1. Unit Tests

用途：验证确定性逻辑。

适合覆盖：

- schema validation。
- answer mode resolution。
- question classification wrapper 的非 LLM 部分。
- plot 参数校验。
- provider fallback 选择。
- SQLite repository 的简单读写。

### 2. API Tests

用途：验证后端接口契约。

必须优先覆盖：

- `GET /health`
- `POST /chat/stream`
- `POST /ocr/recognize`
- `POST /plots/preview`

API tests 应检查：

- 请求字段是否符合 `api-contracts.md`。
- 错误响应是否统一。
- SSE 是否包含约定事件。
- OCR 结果是否只返回可编辑文本，不自动进入聊天。

### 3. Integration Tests

用途：验证跨服务链路。

适合在核心链路初步跑通后添加：

- OCR 识别 -> 用户确认文本 -> chat stream。
- chat metadata -> plot suggestion -> plot preview。
- retrieval fallback -> chat 不阻塞。

### 4. Frontend Checks

用途：验证用户可见体验。

适合覆盖：

- 聊天流式输出可见。
- 回答模式可切换。
- OCR 识别结果可编辑。
- LaTeX 可渲染。
- Plot 图形能显示并交互。
- 错误和 loading 状态可见。

### 5. Evals

用途：验证 Agent 行为质量，弥补普通测试无法判断的部分。

适合覆盖：

- 题型分类是否合理。
- 回答模式是否遵循用户选择。
- 分步引导是否没有过早给完整答案。
- 直接解答是否足够明确。
- 是否应触发可视化。
- 是否编造引用来源。

Evals 存放在 `evals/`，不替代 unit/API tests。

## 任务完成时应跑什么

默认规则：

- 只改文档：读回相关文档，检查索引和 active log。
- 改后端 service：运行相关 unit tests。
- 改后端 API：运行相关 API tests。
- 改 SSE：检查 SSE event shape。
- 改 Agent 行为：更新并运行相关 evals；runner 不存在时至少更新 eval cases。
- 改前端 UI：运行类型检查/构建；重要界面做浏览器检查。
- 改依赖或目录结构：检查相关 docs 和 ADR。

如果测试命令尚不存在，Agent 应说明“测试基础设施尚未建立”，并记录下一步应补的脚本或测试。

## 最小验收样例

在 scaffold 后，应尽快建立这些最小检查：

- 后端 health API test。
- chat stream mock provider test。
- OCR mock provider test。
- plot preview deterministic test。
- agent eval cases runner。
- 前端 smoke check。

## 无法验证时

无法运行验证时，Agent 不能声称完全无误。应使用 `Done with Risk`，并说明：

- 哪个验证没有运行。
- 为什么没有运行。
- 风险是什么。
- 后续如何补验证。

## 不追求的东西

MVP 初期不要求：

- 企业级覆盖率指标。
- 完整端到端自动化套件。
- 所有浏览器矩阵测试。
- 复杂性能压测。

当产品进入可部署阶段，再通过 `release-checklist.md` 增加更严格检查。
