# 技术选型文档（早期草稿）

> Status: early draft / historical reference.
>
> 本文件是项目早期技术选型草稿，不再作为 MVP 技术栈的 source of truth。
> 正式技术栈请以 `docs/01-architecture/tech-stack.md`、`docs/01-architecture/coding-standards.md` 和相关 ADR 为准。
>
> 已被后续 SDD 覆盖的旧假设包括：MVP 不使用 LangGraph、不做完整 RAG/ChromaDB 链路、前端聊天流不以 Axios 或原生 EventSource 为主，而是使用 `fetch` 读取 `POST /chat/stream` 的 SSE stream。

## 1. 选型原则

- **低学习成本**：优先选择开发者已有经验或社区资源丰富的技术
- **AI友好**：Copilot训练数据充足，能生成高质量代码
- **低技术债**：API稳定、迁移成本低、易于维护
- **快速启动**：零配置或少配置，适合MVP快速迭代

---

## 2. 前端技术栈

### 核心框架
- **Next.js 14+ (App Router)**  
  React的全栈框架，提供文件系统路由、服务端渲染(SSR)、静态生成(SSG)和API路由。相比纯React，减少了路由配置和构建优化的工作量，Vercel一键部署。

- **TypeScript**  
  JavaScript的超集，添加静态类型检查。能在编译期发现bug，IDE智能提示更准确，大型项目可维护性显著提升。

- **React 18+**  
  组件化UI库，你已通过React Native熟悉其核心概念（Props、State、Hooks）。Web版React语法与RN 90%相似，只需替换UI组件（如`<View>`改为`<div>`）。

### UI与样式
- **Tailwind CSS**  
  实用优先的CSS框架，通过类名直接应用样式（如`text-center p-4 bg-blue-500`）。无需编写独立的CSS文件，样式与组件紧密耦合，减少上下文切换。

- **react-katex**  
  KaTeX的React封装组件。KaTeX是轻量级LaTeX渲染引擎（~70KB），比MathJax快10倍，支持数学分析常用符号（积分、求和、极限等）。

### 状态管理
- **Zustand**  
  极简的状态管理库，仅需3行代码创建全局store。比Redux简单10倍，比React Context API更灵活，支持中间件和持久化。

### HTTP客户端
- **Axios**  
  基于Promise的HTTP客户端，你之前在ai_note_app项目中已使用。支持请求/响应拦截器，方便统一处理认证token和错误提示。

### 测试（二期）
- **Vitest + React Testing Library**  
  Vitest是现代化的测试运行器，速度比Jest快。React Testing Library专注于用户行为测试（如"点击按钮后是否显示结果"），而非实现细节。

---

## 3. 后端技术栈

### 核心框架
- **FastAPI 0.104+**  
  高性能Python Web框架，基于Starlette和Pydantic。特点：
  - 异步支持（async/await），适合LLM调用等IO密集型任务
  - 自动生成交互式API文档（Swagger UI）
  - 基于类型提示的数据校验，减少手动验证代码

- **Python 3.11+**  
  主流后端语言，生态成熟。3.11版本性能提升显著，类型提示系统完善。

### 数据库与ORM
- **SQLite (开发) → PostgreSQL (生产)**  
  SQLite是嵌入式数据库，无需单独部署服务，数据存储在单个文件中。适合MVP阶段快速启动。PostgreSQL是生产级关系型数据库，支持高并发和复杂查询。两者通过SQLAlchemy ORM抽象，迁移时只需修改连接字符串。

- **SQLAlchemy 2.0 (async)**  
  Python最成熟的ORM（对象关系映射）框架。ORM的作用是将数据库表映射为Python类，让你用面向对象的方式操作数据库，而非编写原生SQL。例如：
  ```python
  # 原生SQL
  cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
  
  # SQLAlchemy ORM
  user = session.query(User).filter(User.id == user_id).first()
  ```
  SQLAlchemy 2.0支持异步操作，与FastAPI无缝集成。

- **Alembic**  
  数据库迁移工具，与SQLAlchemy配套。当你的数据模型变化时（如添加新字段），Alembic自动生成迁移脚本，确保数据库结构与代码同步。

### Agent框架
- **LangGraph 0.0.40+**  
  基于LangChain的Agent编排框架，采用状态机模型。你将Agent逻辑拆分为多个节点（如"问题分类"→"知识检索"→"回复生成"），LangGraph管理节点间的状态传递和执行流程。相比线性链式调用，更适合复杂的多轮对话场景。

### LLM接口
- **OpenAI-compatible API**  
  标准化的LLM调用接口，支持随时切换提供商（OpenAI、Anthropic、智谱、通义千问等）。MVP阶段推荐使用GPT-5.4-mini或Claude Haiku，成本低且速度快。

### 向量数据库（RAG必需）
- **ChromaDB (embedded mode)**  
  嵌入式向量数据库，无需单独部署服务。作用是将文本转换为向量（数字数组），并通过相似度搜索找到相关内容。例如用户问"一致连续的定义"，ChromaDB能从知识库中召回最相关的概念条目。API极简：
  ```python
  import chromadb
  client = chromadb.Client()  # 嵌入式实例
  collection = client.create_collection("math_concepts")
  collection.add(documents=["一致连续的定义..."], ids=["concept_001"])
  results = collection.query(query_texts=["什么是连续？"], n_results=3)
  ```

### 数据校验
- **Pydantic 2.x**  
  基于类型提示的数据验证库。FastAPI内置支持，用于校验API请求参数和LLM输出格式。例如定义一个响应模型：
  ```python
  from pydantic import BaseModel
  
  class ChatResponse(BaseModel):
      content: str
      category: Literal["conceptual", "computational", "proof"]
      hints_count: int
  ```
  Pydantic会自动校验LLM返回的JSON是否符合此结构，不符合则抛出异常。

### 测试
- **pytest + pytest-asyncio**  
  pytest是Python事实标准的测试框架，语法简洁。pytest-asyncio插件支持异步函数测试，适用于FastAPI和LangGraph的异步代码。

---

## 4. DevOps与部署

### 托管平台
- **Vercel (前端)**  
  Next.js官方托管平台，免费额度充足。支持Git推送自动部署、预览分支、边缘网络加速。零配置，只需关联GitHub仓库。

- **Railway / Render (后端)**  
  支持Python应用的云平台，提供免费层级。Railway操作简单，Render稳定性更好。两者都支持环境变量管理和自动重启。

### CI/CD
- **GitHub Actions**  
  GitHub内置的自动化工作流。配置为每次push到main分支时自动运行pytest，确保代码质量。也可配置自动部署到Vercel/Railway。

### 环境管理
- **python-dotenv + .env.local**  
  从`.env`文件加载环境变量，避免硬编码敏感信息（如API密钥）。开发时使用`.env.local`，生产时从云平台的环境变量面板配置。

---

## 5. 监控与日志

### 日志
- **Python logging module + structured JSON**  
  Python标准库的logging模块，配置为输出JSON格式的日志，便于后续分析和排查问题。记录关键事件如"LLM调用耗时"、"RAG检索结果数量"等。

### 错误追踪（可选）
- **Sentry (free tier)**  
  实时错误监控平台，捕获未处理的异常并发送通知。免费版每月5000个错误事件，足够MVP使用。

---

## 6. 初期技术选型考虑

### 为什么选择这些技术？

| 决策点 | 考虑因素 | 最终选择 |
|--------|----------|----------|
| **前端框架** | 你有React Native经验，希望降低学习成本 | Next.js（React生态，约定优于配置） |
| **后端框架** | 无后端经验，需要简单易上手的方案 | FastAPI（自动文档、类型安全、异步支持） |
| **数据库** | MVP阶段不想运维独立数据库服务 | SQLite（零配置，后续可迁移到PostgreSQL） |
| **Agent框架** | 需要清晰的状态管理和调试能力 | LangGraph（状态机模型，LangChain生态） |
| **向量存储** | 不想部署独立服务，数据量小 | ChromaDB嵌入式模式（类似SQLite的理念） |
| **测试策略** | 时间有限，优先保证核心逻辑正确 | 仅后端pytest单元测试，前端手动测试 |

### 技术债风险评估

| 技术选择 | 风险等级 | 说明 |
|----------|----------|------|
| SQLite → PostgreSQL迁移 | 🟢 低 | SQLAlchemy ORM抽象良好，迁移成本低 |
| ChromaDB扩展性 | 🟡 中 | 向量数据超过10万条时需评估迁移，但MVP阶段完全够用 |
| LangGraph API稳定性 | 🟡 中 | 框架仍在快速发展，需关注版本更新日志 |
| Next.js App Router | 🟢 低 | 已成稳定特性，社区广泛采用 |

---

## 7. 完整技术栈清单

```yaml
Frontend:
  Framework: Next.js 14+ (App Router)
  Language: TypeScript
  UI Library: React 18+
  Styling: Tailwind CSS
  State Management: Zustand
  LaTeX Rendering: react-katex (KaTeX)
  HTTP Client: Axios
  Testing: Vitest + React Testing Library (二期)

Backend:
  Framework: FastAPI 0.104+
  Language: Python 3.11+
  ORM: SQLAlchemy 2.0 (async)
  Database: SQLite (dev) → PostgreSQL (prod)
  Migration Tool: Alembic
  Agent Framework: LangGraph 0.0.40+
  LLM Provider: OpenAI-compatible API
  Vector DB: ChromaDB (embedded mode)
  Validation: Pydantic 2.x
  Testing: pytest + pytest-asyncio

DevOps:
  Frontend Hosting: Vercel
  Backend Hosting: Railway / Render
  CI/CD: GitHub Actions
  Environment: python-dotenv

Monitoring:
  Logging: Python logging (JSON format)
  Error Tracking: Sentry (optional)
```

---

**文档版本**：v1.0  
**最后更新**：2026-04-14  
**下一步**：进入Phase 3 - Harness规范设计
