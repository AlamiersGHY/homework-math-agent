# API App

FastAPI backend for Math Agent.

## Local Setup

```powershell
py -3.12 -m venv .venv
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
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_API_KEY=your_api_key_here
LLM_MOCK_FALLBACK=true
```

`.env` is ignored by Git. If `LLM_API_KEY` is empty and `LLM_MOCK_FALLBACK=true`, `/chat/stream` keeps using the local mock stream.

## Test

```powershell
.\.venv\Scripts\python -m pytest
```

Current scaffold implements:

- `GET /health`
- `POST /chat/stream` SSE endpoint with OpenAI-compatible LLM provider support and mock fallback
