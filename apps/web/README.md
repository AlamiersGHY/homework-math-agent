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

- Math Agent chat workspace UI.
- `POST /chat/stream` SSE integration through native `fetch`.
- Direct, guided, and hint answer mode switching.
- Markdown and LaTeX rendering for chat messages.
- Lightweight in-memory conversation state with a new-session flow.
- Follow-up suggestion chips after completed answers.
