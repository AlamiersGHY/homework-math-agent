# Web App

Next.js frontend for Math Agent.

## Local Setup

```powershell
npm install
```

## Run

```powershell
npm run dev
```

If you start the web app directly from `apps/web`, copy `.env.example` to `.env.local`
or set this environment variable before running Next:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

PDF material upload, retrieval, sessions, OCR, and plot preview all use the same
FastAPI base URL. There is no separate PDF API key or frontend secret.

From the repository root, the preferred local demo entry is:

```powershell
.\scripts\dev.ps1
```

It starts the FastAPI backend and the Next.js frontend together and points the web app at the local API.
If you change the API port for a production build/start flow, rebuild the web app so the
`NEXT_PUBLIC_API_BASE_URL` value is embedded correctly.

## Build

```powershell
npm run build
```

Current frontend provides:

- Math Agent learning workspace UI with a local session rail.
- `POST /chat/stream` SSE integration through native `fetch`.
- Direct, guided, and hint answer mode switching.
- Markdown and LaTeX rendering for chat messages.
- SQLite-backed session history through the backend session APIs.
- PDF course-material upload/list/delete through a compact chat-first materials strip.
- Citation/source cards under assistant answers when retrieval finds uploaded material.
- History replay for retrieved-source metadata, plot suggestions, and generated plots.
- OCR image upload with editable recognition confirmation before chat.
- Plotly-backed plot preview rendering for chat visualization suggestions.
  - Supported demo plots include 2D functions, simple 3D `z=f(x,y)` surfaces, bounded 2D regions, and MVP implicit 3D surfaces such as `x^4 + y^4 + z^4 = 1` supplied by the backend.

## Browser QA

Run browser QA from the repository root:

```powershell
.\scripts\browser-qa.ps1
```

The workspace is checked with Playwright against a mock backend on:

- Desktop viewport: `1440x1000`
- Mobile viewport: `390x844`

The checked paths cover initial workspace layout, PDF material upload and citation display/history replay, chat streaming, visualization suggestion to Plotly render, OCR mock recognition to confirmed chat input, session/material deletion, and mobile input-mode switching. Screenshots are written under `.cache/qa/` and are ignored by Git.
