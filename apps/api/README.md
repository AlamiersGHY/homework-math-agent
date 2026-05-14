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

## Test

```powershell
.\.venv\Scripts\python -m pytest
```

Current scaffold implements:

- `GET /health`
- mock `POST /chat/stream` SSE endpoint
