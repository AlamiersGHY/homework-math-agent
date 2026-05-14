# 完成定义

本文档定义 Agent 在本项目中什么时候可以认为任务完成。这里的“无误”不是绝对没有任何问题，而是：在当前任务范围内，需求、实现、验证和 SDD 状态已经对齐，剩余风险被明确记录。

## 完成状态

Agent 结束任务时只能归入以下状态之一：

- `Done`：任务完成，相关验证已通过，SDD 状态已同步。
- `Done with Risk`：任务主体完成，但有无法运行的验证、外部依赖限制或已知风险；风险必须记录。
- `Blocked`：无法继续执行，原因必须明确，下一步需要用户或外部条件。
- `Needs Decision`：继续执行会改变产品范围、架构、API、依赖或长期方向，需要用户决策或 ADR。

不要把“代码写完了”当成任务完成。实现只是完成条件之一。

## 通用完成检查

非平凡任务完成前必须检查：

- 范围符合 `docs/00-product/scope.md`。
- 架构符合 `docs/01-architecture/`。
- 文件放置符合 `docs/01-architecture/directory-rules.md`。
- API 变化已同步 `docs/01-architecture/api-contracts.md`。
- 长期决策已记录到 `docs/03-decisions/`。
- 行为变化已更新或新增 `evals/`。
- 测试或 eval 已按 `testing-strategy.md` 运行；不能运行时说明原因。
- `docs/04-logs/active.md` 反映当前进展、下一步和阻塞。
- 有意义的里程碑已记录到 `docs/04-logs/completed.md`。
- 延后处理的问题已记录到 `docs/04-logs/tech-debt-tracker.md`。
- 完整可交付单元已创建本地 Git checkpoint commit，除非用户明确要求不提交，或存在无法安全分离的无关改动。

## 按任务类型的完成要求

### 文档任务

完成条件：

- 文档有明确职责，不重复其他文档的权威内容。
- `docs/INDEX.md` 能正确路由到该文档。
- 如果改变当前状态，已更新 `active.md` 或 `completed.md`。
- 如果改变长期决策，已新增或更新 ADR。

验证方式：

- 读回修改后的文档。
- 检查与产品范围、架构决策和 active log 不冲突。

### 后端任务

完成条件：

- Route、schema、service、provider 分层符合 architecture 文档。
- Pydantic schema 与 API 契约一致。
- 外部 provider 没有写死在 route handler 中。
- 错误返回遵循统一结构。
- SQLite 使用不引入登录或长期用户系统，除非 scope 已更新。

验证方式：

- 优先运行相关 pytest。
- 涉及 API 时运行 API tests。
- 涉及 SSE 时检查事件形态。

### 前端任务

完成条件：

- API 调用集中在前端 API helper。
- 聊天、OCR、plot、LaTeX 渲染组件边界清楚。
- UI 支持必要 loading、error 和空状态。
- 文本和公式在常见视口下不明显溢出。

验证方式：

- 优先运行构建、类型检查或前端测试。
- 重要 UI 变更需要浏览器手动或自动检查。

### Agent 行为任务

完成条件：

- 回答模式符合 `scope.md`。
- 行为变化有 eval case。
- 不强制所有问题都走苏格拉底式回答。
- 不编造资料来源。
- 可视化触发或不触发有合理依据。

验证方式：

- 运行相关 eval runner；如果 runner 尚未实现，至少更新 eval case 并说明未自动执行。

### API 契约任务

完成条件：

- `api-contracts.md` 已更新。
- 前端调用和后端 schema 使用同一语义。
- 破坏性变更被明确说明。

验证方式：

- 运行 API tests 或最小请求检查。

## 何时必须停下来要决策

遇到以下情况不能直接继续实现：

- 要改变 MVP 必做/不做范围。
- 要引入新的框架或关键依赖。
- 要改变已接受 ADR。
- 要新增登录、账户、完整 RAG、长期记忆或重型 Agent 编排。
- 要选择付费外部 provider 作为唯一实现。
- 用户反馈相互冲突，且会影响产品行为。

这种情况下，Agent 应标记 `Needs Decision`，说明候选方案和推荐方案。

## Git Checkpoint

当一个完整可交付单元达到 `Done` 或 `Done with Risk` 后，Agent 应自动创建本地 Git checkpoint commit。

可交付单元可以是：

- 一个完成并验证的功能切片。
- 一个完成并验证的 bug 修复。
- 一个完成的文档或 workflow 更新。
- 一个完成的 scaffold、API 契约或测试基座。

提交前必须：

- 检查 `git status`。
- 只暂存属于当前可交付单元的文件。
- 不提交 `.env`、密钥、本地虚拟环境、依赖目录、缓存、构建产物或无关用户改动。
- 如果存在无法安全区分的无关改动，停止自动提交并说明原因。

不应自动提交：

- 仅讨论或规划、没有文件变化的任务。
- 未完成的中间状态。
- `Blocked` 状态。
- `Needs Decision` 状态。

## 最终回复要求

Agent 完成任务时应简要说明：

- 改了什么。
- 如何验证。
- 哪些没有验证。
- 是否有剩余风险或后续事项。
- 如创建了 Git checkpoint，说明 commit hash。

如果任务涉及文件，应引用关键文件路径。不要把长篇过程日志当作最终回复。
