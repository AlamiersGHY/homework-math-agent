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
- OCR image upload with editable recognition confirmation before chat.
- Plotly-backed plot preview rendering for chat visualization suggestions.

## Browser QA

The current workspace has been checked with Playwright against a mock backend on:

- Desktop viewport: `1440x1000`
- Mobile viewport: `390x844`

The checked paths cover initial workspace layout, chat streaming, visualization suggestion to Plotly render, and OCR mock recognition to confirmed chat input.
