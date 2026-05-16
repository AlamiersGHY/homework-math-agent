# 发布检查清单

本文档定义项目从本地可运行进入可演示、可试用或临时部署前需要检查的事项。当前是 MVP 发布清单，不是长期生产发布流程。

## 发布前置条件

发布前必须满足：

- 产品范围与 `docs/00-product/scope.md` 一致。
- API 契约与 `docs/01-architecture/api-contracts.md` 一致。
- 架构未绕过 provider/service 边界。
- `docs/04-logs/active.md` 没有阻塞项。
- 已知风险已记录到 `tech-debt-tracker.md`。

## 本地检查

发布前应完成：

- 前端能启动。
- 后端能启动。
- `GET /health` 正常。
- chat stream 能返回 SSE 事件。
- OCR mock 或实际 provider 链路能返回可编辑文本。
- plot preview 能返回可渲染 spec。
- 前端能完成一次文本聊天。
- 前端能展示 OCR 结果确认流程。
- 前端能展示至少一个 plot。

## 验证检查

发布前应运行：

- 后端相关 unit/API tests。
- 关键 Agent evals。
- 前端类型检查或构建。
- 关键页面浏览器检查。

当前可重复命令：

```powershell
.\scripts\release-check.ps1
```

如本地 `.env` 已配置真实 OpenAI-compatible LLM，可追加：

```powershell
.\scripts\release-check.ps1 -LiveLLM
```

`-LiveLLM` 同时验证后端生成的推荐追问，最终 chat metadata 必须返回 `quick_reply_source=llm`。

Doubao OCR live smoke 仍需真实 `DOUBAO_API_KEY` 和 `DOUBAO_VISION_MODEL`，没有凭据时不得把 live OCR 视为已通过。

如果某项暂时无法运行，应记录为发布风险，而不是默认为通过。

## 配置检查

发布前应确认：

- 没有提交真实 API key。
- `.env` 或平台环境变量已说明。
- 外部 provider 有 mock 或 fallback。
- 付费 provider 不作为唯一可运行路径，除非明确接受该成本。
- SQLite 文件位置适合当前部署方式。

## 演示检查

MVP 演示至少覆盖：

- 用户输入数学问题。
- 用户切换回答模式。
- Agent 流式输出回答。
- 用户上传图片并确认 OCR 文本。
- 用户看到一个 2D 或 3D 可视化。

演示路径应尽量短，避免依赖复杂账户、预置环境或人工手动修复。

## 发布后检查

发布后应记录：

- 线上访问地址。
- 测试时间和测试人。
- 成功路径。
- 失败路径。
- 用户反馈。
- 下一步修复项。

用户反馈应进入 `feedback-loop.md` 的流程，不要只留在聊天记录中。
