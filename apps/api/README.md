# API App

FastAPI backend for Math Agent.

## Local Setup

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
```

## Run

```powershell
$env:PYTHONPATH = "src"
.\.venv\Scripts\python -m uvicorn math_agent_api.main:app --reload
```

## LLM Provider

Copy `.env.example` to `.env` and fill the key locally:

```powershell
Copy-Item .env.example .env
```

Default first real provider target:

```env
DATABASE_URL=sqlite:///math_agent.db
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=your_api_key_here
LLM_MOCK_FALLBACK=true
```

`.env` is ignored by Git. If `LLM_API_KEY` is empty and `LLM_MOCK_FALLBACK=true`, `/chat/stream` keeps using the local mock stream.

## Local Session Data

The MVP demo stores lightweight local session history in SQLite. By default the API uses:

```env
DATABASE_URL=sqlite:///math_agent.db
```

This stores sessions, messages, and future OCR/plot artifacts in `apps/api/math_agent.db`. The database file is ignored by Git.

## OCR Provider

OCR is mock-first for local tests and can be switched to Doubao Vision after credentials are configured.

Default test-safe configuration:

```env
OCR_PROVIDER=mock
OCR_MOCK_FALLBACK=true
```

Doubao Vision configuration:

```env
OCR_PROVIDER=doubao_vision
OCR_MOCK_FALLBACK=true
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_API_KEY=your_volcengine_ark_api_key
DOUBAO_VISION_MODEL=your_vision_model_or_endpoint_id
```

To get Doubao credentials, create a Volcengine account, open the Ark console, create an API key under API key management, and enable or create access to a vision-capable Doubao model. Put the key only in local `.env`; do not paste it into source files or commit it.

Mathpix is intentionally not the active MVP OCR provider, but the environment placeholders are present for a future adapter.

## Test

```powershell
.\.venv\Scripts\python -m pytest
```

Current scaffold implements:

- `GET /health`
- `POST /chat/stream` SSE endpoint with OpenAI-compatible LLM provider support and mock fallback
- `POST /ocr/recognize` with mock fallback and Doubao Vision provider support
- `POST /plots/preview` for Plotly-style `function2d`, `surface3d`, and bounded `region2d` previews
- `GET /sessions`
- `GET /sessions/{session_id}`
