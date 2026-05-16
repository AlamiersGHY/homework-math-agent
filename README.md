# Math Agent 数学学习助手

Math Agent 是一个面向数学分析学习场景的 AI 助手 demo，支持数学问答、公式渲染、图片 OCR、PDF 课程材料检索引用，以及 2D/3D 图形可视化。

这个项目目前定位为课程作业和 MVP 演示项目：优先保证核心体验可用、流程完整、便于本地运行和后续云端部署。

## 项目概览

Math Agent 不是通用聊天机器人，而是一个围绕数学学习过程设计的轻量工作台。用户可以输入文本题目、上传题目图片、上传 PDF 课程材料，并通过不同回答模式获得直接解答、分步引导或关键提示。对于适合可视化的问题，系统会自动生成 Plotly 图形辅助理解。

当前项目由两部分组成：

- `apps/web`：Next.js 前端学习工作台。
- `apps/api`：FastAPI 后端，负责对话、OCR、PDF 检索、图形生成和本地数据存储。

## 主要功能

- 流式数学对话：通过 SSE 实时输出回答。
- 回答模式切换：支持直接解答、分步引导、仅提示。
- Markdown 与 LaTeX 渲染：用于展示数学公式和推导过程。
- 图片 OCR 流程：上传图片后识别题目文本，再进入对话。
- PDF 材料检索：上传课程 PDF 后，可在回答中引用相关来源片段。
- 图形可视化：支持常见 2D 函数图、3D 曲面、简单区域和部分隐式曲面展示。
- 会话历史：本地保存轻量会话、消息、材料和图形记录。

## 在线体验

线上地址后续部署完成后补充：

- 前端体验地址：待补充
- 后端健康检查：待补充

## 本地启动

### 1. 安装后端依赖

```powershell
cd apps/api
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
```

### 2. 安装前端依赖

```powershell
cd apps/web
npm install
```

### 3. 从项目根目录启动

回到项目根目录后运行：

```powershell
.\scripts\dev.ps1
```

默认访问地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:8000`

## 环境变量说明

后端环境变量位于 `apps/api/.env`。可以从示例文件复制：

```powershell
cd apps/api
Copy-Item .env.example .env
```

本地 mock 开发可以使用：

```env
DATABASE_URL=sqlite:///math_agent.db
LLM_PROVIDER=mock
OCR_PROVIDER=mock
```

如果需要真实 LLM 或 OCR，需要在 `apps/api/.env` 中配置对应 key。真实 API key 只应放在后端环境变量中，不要提交到 Git，也不要写入前端代码。

前端只需要知道后端 API 地址。如果单独启动 `apps/web`，可创建 `apps/web/.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

`NEXT_PUBLIC_` 开头的变量会暴露给浏览器，因此不要在其中放任何 API key。

## 常用验证命令

从项目根目录运行：

```powershell
.\scripts\check.ps1
```

执行后端测试、确定性 eval、前端类型检查和前端构建。

```powershell
.\scripts\browser-qa.ps1
```

启动本地 mock 环境并进行桌面端和移动端浏览器检查。

```powershell
.\scripts\release-check.ps1
```

执行发布前完整检查，包括测试、eval、构建、mock API smoke、浏览器 QA 和依赖审计提示。

如果本地已经配置真实 LLM key，可以额外运行：

```powershell
.\scripts\release-check.ps1 -LiveLLM
```

## 项目结构

```text
.
|-- apps/
|   |-- api/       # FastAPI 后端
|   `-- web/       # Next.js 前端
|-- docs/          # SDD 文档、架构和工作流记录
|-- evals/         # Agent 行为与可视化行为评估用例
|-- scripts/       # 本地启动、测试、QA 和发布检查脚本
|-- AGENTS.md      # AI agent 协作协议
`-- README.md
```

更多产品范围、系统架构、API 契约和当前进度可以查看 `docs/INDEX.md`。

## 部署说明

当前推荐的第一阶段部署方式：

- 使用 GitHub 保存完整项目仓库。
- 使用 Vercel 部署 `apps/web` 前端。
- 使用 Render 或 Railway 部署 `apps/api` FastAPI 后端。
- 真实 API key 放在后端部署平台的环境变量中。
- 前端只配置 `NEXT_PUBLIC_API_BASE_URL`，指向线上后端地址。

Supabase 不是当前第一阶段必须项。后续如果需要稳定保存线上聊天历史、PDF 材料、检索 chunk 或用户数据，可以再考虑接入 Supabase Postgres 或其他云数据库。

公网部署时需要特别注意：

- 不要提交 `.env`、数据库文件或真实 API key。
- 给 DeepSeek、Doubao Vision 等 provider 设置可接受的额度或限额。
- 没有登录和限流时，任何能访问网站的人都可能消耗后端 API key 额度。
- 如需降低 OCR 成本风险，可以先在线上使用 mock OCR，确认限额后再启用真实 Doubao Vision。

## 项目状态与限制

这个项目目前是课程作业和 MVP demo，不是长期生产系统。当前明确不包含：

- 登录、注册和权限系统。
- 多用户隔离和跨设备同步。
- 生产级限流、审计和安全防护。
- 完整 RAG 平台或复杂知识库管理。
- 专业 CAS 或专业数学绘图软件能力。

因此，它适合用于课程展示、轻量测试和功能演示。如果需要面向更多用户长期开放，应先补充鉴权、限流、云数据库、成本监控和部署安全检查。
