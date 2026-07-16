# KashinAI2 — Local AI Context Engine

A local-first AI backend that continuously understands your computer activity,
stores contextual memory on your machine, retrieves relevant information with
RAG, and lets an LLM (Google Gemini) act on your OS and cloud apps through
tool/function calling. Includes a Chrome extension and offline voice input.

> **Status:** working prototype hardened for security, reliability, and tests.
> See [`AUDIT.md`](./AUDIT.md) for the full audit and [`ROADMAP.md`](./ROADMAP.md)
> for what's planned next.

---

## Features

### Context collection
Background collectors capture activity (each degrades gracefully if its
external tool is missing — see the startup binary check):
Active window · Clipboard · Browser history · Selected text · Screen OCR ·
Slack · Google Calendar · VS Code.

### Local memory (RAG)
SQLite + Prisma for the timeline, LanceDB + Transformers.js (all-MiniLM-L6-v2)
for semantic vector search — all local, nothing uploaded.

### LLM orchestration
Google Gemini with automatic tool selection (keyword + semantic), an agentic
multi-step loop, and **per-session multi-turn conversation history**.

### Action layer
Local: open URLs, create directories, open files in VS Code, browser
automation (Playwright). Cloud: Slack, Gmail, Google Calendar, GitHub, Notion.
**Destructive actions require an explicit yes/no confirmation.**

### Security & privacy
- **API-token auth** on state-changing routes + configurable CORS allowlist.
- **Secret redaction** of captured clipboard/OCR/selected-text before storage.
- **Memory retention** pruning so local stores don't grow unbounded.
- Shell-injection-safe action execution; email-header & URL-scheme validation.

### Voice
Offline transcription (ffmpeg-static + local Whisper via `@xenova/transformers`).

### Cross-platform
macOS · Linux (X11 & Wayland) · Windows.

---

## Tech stack

| Technology | Purpose |
|------------|---------|
| Node.js / TypeScript | Backend runtime & language |
| Express | REST API |
| Prisma + SQLite | Timeline store |
| LanceDB + Transformers.js | Vector store & embeddings |
| Google Gemini | LLM |
| Playwright | Browser automation |
| Whisper (@xenova/transformers) | Local speech-to-text |

---

## Prerequisites

- Node.js 18+ and npm
- Platform tools (optional — the server warns at startup about any missing one):
  - **Linux:** `sudo apt install sqlite3 xdotool xclip wl-clipboard tesseract-ocr gnome-screenshot`
  - **macOS:** `brew install sqlite tesseract`
  - **Windows:** Tesseract OCR on PATH; the VS Code `code` command on PATH.

---

## Installation

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npx playwright install chromium   # only if you use browser automation
```

Create a `.env` from the template:

```bash
cp .env.example .env
```

Then fill it in. Key variables (see `.env.example` for the full list):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required for `/chat`) |
| `API_TOKEN` | **Set this.** Shared token required on state-changing routes. If unset, those routes run unauthenticated (dev only) and the server warns. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist (optional) |
| `MEMORY_RETENTION_DAYS` | Days to keep memories before pruning (default 30; 0 disables) |
| `CALENDAR_TIMEZONE` | IANA tz for created/updated calendar events (optional) |
| `SLACK_BOT_TOKEN` / `SLACK_USER_TOKEN` | Slack bot token; user token only needed for message search |
| `GITHUB_TOKEN`, `NOTION_API_KEY` | Integration credentials |
| `DISABLE_SECRET_REDACTION` | Set `true` to disable capture-time secret redaction |

---

## Google OAuth setup

1. In Google Cloud Console, create a project and enable the **Gmail API** and
   **Google Calendar API**.
2. Configure the OAuth consent screen and add yourself as a test user.
3. Create an OAuth Client ID of type **Desktop Application**, download it, and
   save it as `google_credentials.json` in the project root (or point
   `GOOGLE_CREDENTIALS_PATH` at it).
4. Generate a token:

   ```bash
   npx ts-node src/auth/googleAuth.ts
   ```

   This writes `google_token.json`. The backend then auto-refreshes and
   persists the access token as needed.

---

## Running

```bash
npm run dev      # tsx watch (development)
# or
npm run build && npm start
```

Server runs on `http://localhost:3001`.

---

## REST API

State-changing routes (`/chat`, `/actions/execute`, `/memory/store`,
`/voice/query`) require the `x-api-token` header (or `Authorization: Bearer …`)
when `API_TOKEN` is set. Pass an optional `x-session-id` header on `/chat` and
`/voice/query` to keep separate conversation histories.

```
GET  /health
GET  /context/current
GET  /context/recent?limit=10
GET  /memory/search?query=<q>
POST /memory/store            { type, content, app?, window? }
POST /retrieve                { prompt }
POST /chat                    { prompt, sessionId? }
POST /llm/query               { prompt }
POST /actions/execute         { toolName, args }
POST /voice/query             multipart: audio=<file>
```

### Example

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -H "x-api-token: $API_TOKEN" \
  -d '{"prompt":"What is my current VS Code workspace?"}'
```

---

## Chrome extension

Load `kashinai-extension/` as an unpacked extension. Store your API token so
the extension can authenticate (run in the extension's service-worker console):

```js
chrome.storage.local.set({ kashinaiToken: '<your API_TOKEN>' });
```

Trigger it on any page with `Ctrl+Shift+Space` (`Cmd+Shift+Space` on macOS).

---

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm test            # node test runner via tsx
```

CI runs install → prisma generate → typecheck → test on every push/PR
(`.github/workflows/ci.yml`).

---

## Project structure

```
src/
├── actions/        ActionExecutor (tool dispatch)
├── auth/           googleAuth (OAuth flow) + googleClient (shared refresh)
├── collectors/     background context collectors
├── db/             Prisma client
├── integrations/   Slack, Gmail, Calendar, GitHub, Notion, Browser, VS Code
├── llm/            GeminiProvider, OrchestratorService, Toolregistry
├── memory/         MemoryService, VectorService, retention, shared instance
├── middleware/     auth (API token + CORS)
├── retriever/      RetrieverService (RAG assembly)
├── security/       inputValidation, redaction
├── utils/          logger, binaryCheck
├── voice/          Whisper transcription pipeline
├── app.ts          Express app
└── server.ts       entrypoint (collectors + retention scheduler)

tests/              unit + e2e tests
prisma/             schema & migrations
kashinai-extension/ Chrome extension
```

---

## Security notes

- Local-first: context stays on your machine.
- Set `API_TOKEN` before exposing the server to anything but localhost.
- Captured content is secret-redacted before storage, but treat the local
  SQLite/LanceDB stores as sensitive regardless.

---

## License

MIT
