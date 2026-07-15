# KashinAI2 — Product Audit

_Last updated: 2026-07-15_

This document captures a full-codebase audit of KashinAI2 (a local AI context
engine backend) and tracks the gaps that block it from being a shippable
product. The **P0 security fixes** section marks what has already been
addressed in this branch.

---

## 1. What the product is

A **local AI context engine**. It continuously collects computer activity
(active window, clipboard, browser history, selected text, screen OCR, Slack,
Google Calendar, VS Code), stores it locally in SQLite + LanceDB, retrieves
relevant context via RAG (Transformers.js local embeddings + LanceDB vector
search), and lets Google Gemini answer questions and perform actions through
tool/function calling. Ships with a Chrome extension and local voice input
(offline Whisper via `@xenova/transformers`).

**Completeness: working prototype.** Almost every advertised feature has a real
implementation (the only true stubs are `VSCodeIntegration.getCursorPosition`
and `readSelectedCode`). But several serious gaps block productization.

---

## 2. What works (strengths)

- All 8 collectors are implemented with per-OS (macOS/Linux/Windows) branches.
- Genuine local-first RAG pipeline (all-MiniLM-L6-v2 embeddings + LanceDB).
- Two-tier tool selection (keyword → semantic embedding similarity).
- Confirmation gate before destructive actions (email send, issue creation…).
- Fully local voice pipeline (ffmpeg-static + local Whisper/ONNX).
- Agentic multi-step tool loop (max 5 steps).

---

## 3. Critical gaps & risks

### Security

| Issue | Location | Description |
|---|---|---|
| **No API auth + wide-open CORS** | `app.ts` | Any website could drive `localhost:3001/chat` and trigger actions (send email, create files, post to Slack). The extension's injected script runs in the visited page's origin, so CORS alone cannot distinguish it — a shared **API token** is the real defense. |
| **Shell injection** | `VSCodeIntegration.openFile`, `ActionExecutor.openVsCode/openUrl/createDirectory` | Unsanitized, LLM-driven input interpolated into `exec` shell strings → arbitrary command execution. |
| **Email header injection** | `GmailIntegration` | Newlines in `to`/`subject` allowed injecting extra headers (e.g. Bcc). |
| **No URL scheme allowlist** | `BrowserAutomationIntegration.navigate` | `file://` / `javascript:` reachable → local file read / SSRF. |
| **Secret leakage** | collectors, `browser_fill` | Clipboard / screen OCR capture passwords & sensitive screens in plaintext; `fill` echoed the typed value back into model context. |

### Architecture / correctness

- **Global confirmation state**: `OrchestratorService.pendingCalls` was a
  singleton field with no session concept → concurrent requests could mix
  (one user's "yes" executing another's pending action).
- **Conversation not persisted**: `/chat` is stateless across turns.
- **Duplicated `MemoryService`**: `app.ts` and `server.ts` each construct one,
  double-loading the embedding model and LanceDB connection.
- **Dead `case`**: `create_calendar_event` appeared twice in `ActionExecutor`.
- **Unbounded memory growth**: no retention / pruning of SQLite or LanceDB.
- **`SelectedTextCollector` is destructive**: synthesizes Ctrl+C every 5s and
  clobbers the user's clipboard (restore left as a TODO).

### Google integrations unusable over time

- **No token refresh** (Gmail / Calendar / CalendarReadCollector): expired
  access tokens fail forever, and the empty `catch` blocks hide it.
- Credential paths hardcoded to `process.cwd()`; `credentials.installed` shape
  assumed (breaks for `web` client type).

---

## 4. Missing product foundations

- **Zero tests** (no unit / e2e).
- **No CI/CD** (`.github/workflows` absent).
- **No linter/formatter** config.
- **No `.env.example`** (added in this branch).
- **No observability**: no structured logging; most collectors/integrations
  swallow errors in empty `catch` blocks → failures are invisible.
- **Errors returned as strings**: integrations never throw, so callers/LLM
  cannot reliably tell success from failure.
- **No presence checks for external binaries** (`xdotool`, `xclip`,
  `wl-paste`, `sqlite3`, `tesseract`, `gnome-screenshot`, `code`).
- **Linux Wayland gaps** (no selected-text path; active-window relies on
  GNOME `Eval`, disabled by default).
- **Docs drift**: README project name (`ai-context-engine`) ≠ package
  (`kashinai2`); voice API and extension undocumented.

---

## 5. Prioritized roadmap

**P0 — pre-ship security (addressed in this branch)**
1. API-token auth on state-changing routes + configurable CORS allowlist.
2. Remove shell injection (`execFile`/`fs` instead of `exec` strings); Gmail
   header sanitization; browser-navigate URL scheme allowlist.
3. Session-scoped confirmation state in the orchestrator.

**P1 — reliability**
4. Google token auto-refresh.
5. Single shared `MemoryService`.
6. Replace empty `catch` blocks with structured logging + real error returns;
   remove the duplicate `ActionExecutor` case.
7. Startup checks for external binaries.

**P2 — productization**
8. Tests (tool selection, confirmation flow, executor dispatch) + CI.
9. ESLint/Prettier, data-retention policy, secret masking/redaction.
10. Persist conversation history; update README.

---

## 6. Changelog

- **2026-07-15** — P0 security fixes landed: API-token auth middleware +
  CORS allowlist, `execFile`/`fs`-based action execution (no shell strings),
  Gmail header sanitization, browser URL allowlist, session-scoped
  confirmation state, `browser_fill` no longer echoes values, `.env.example`
  added, duplicate `ActionExecutor` case removed.
</content>
