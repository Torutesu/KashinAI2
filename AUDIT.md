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
- ~~**Unbounded memory growth**: no retention / pruning of SQLite or LanceDB.~~
  **Fixed** — `MEMORY_RETENTION_DAYS` pruning (see changelog).
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

- **2026-07-15** — Secret redaction on capture:
  - `src/security/redaction.ts` strips obvious secrets (provider tokens, JWTs,
    PEM private keys, Bearer tokens, `key=value` secret assignments, Luhn-valid
    card numbers) from clipboard / screen-OCR / selected-text content before it
    is persisted to SQLite or LanceDB. Opt out with `DISABLE_SECRET_REDACTION=true`.
    Unit tested (6 cases).

- **2026-07-15** — Memory retention policy added:
  - `MemoryService.pruneOldMemories()` deletes SQLite rows and LanceDB memory
    vectors older than `MEMORY_RETENTION_DAYS` (default 30; 0 disables); the
    INIT seed row and tool index are preserved.
  - Scheduled from `server.ts` (first run after 60s, then every 6h) so the
    local stores no longer grow without bound. Pure cutoff helper unit-tested.

- **2026-07-15** — Remaining reliability bugs fixed:
  - **SelectedTextCollector no longer clobbers the clipboard**: Linux reads the
    PRIMARY selection directly (X11 `xclip -selection primary`, Wayland
    `wl-paste --primary`) — no synthetic Ctrl+C at all; macOS/Windows still
    simulate a copy but now save and restore the clipboard around it. Adds
    Wayland support.
  - **Notion**: API-key guard on every method (was only `searchPages`);
    `readPage` now extracts text from all common block types (headings, lists,
    to-dos, quotes…) not just paragraphs; `createPage` discovers the database's
    real title property instead of assuming it's named `Name`.
  - **Slack**: channel lookup/search now follows cursor pagination (large
    workspaces no longer miss channels beyond the first 200); `searchConversations`
    uses a proper user token (`SLACK_USER_TOKEN`) and returns a clear message
    instead of failing opaquely with a bot token.
  - **Calendar**: created/updated events attach `CALENDAR_TIMEZONE` (IANA tz)
    when set, avoiding ambiguous bare datetimes.
  - **GitHub**: use the current `Bearer` auth scheme.
  - `.env.example` documents the new optional vars. Typecheck + 18 tests green.

- **2026-07-15** — P2 test + CI foundation landed:
  - First automated tests (`tests/`, Node's built-in runner via tsx): input
    validation (header sanitization + URL allowlist), tool-selection logic,
    API-token auth + CORS allowlist, and binary presence check — 18 tests,
    focused on the P0/P1 behavior so it can't silently regress.
  - `npm run test` and `npm run typecheck` scripts.
  - GitHub Actions CI (`.github/workflows/ci.yml`): install → prisma generate →
    typecheck → test on every push/PR.

- **2026-07-15** — P1 reliability fixes landed:
  - **Google token auto-refresh**: new shared `src/auth/googleClient.ts` used by
    Gmail, Calendar, and the calendar collector — auto-refreshes the access
    token and persists it back to disk; supports `installed` *and* `web`
    credential shapes and configurable paths (`GOOGLE_CREDENTIALS_PATH` /
    `GOOGLE_TOKEN_PATH`).
  - **Single shared `MemoryService`** (`src/memory/instance.ts`) — no more
    double embedding-model load / split reader-writer instances.
  - **Observability**: throttled logger (`src/utils/logger.ts`) replaces the
    silent `catch {}` blocks in the Slack / VSCode / SelectedText / ScreenOCR /
    Calendar collectors (logs at most once / 5 min per source).
  - **Startup binary check** (`src/utils/binaryCheck.ts`) — warns about missing
    `sqlite3` / `tesseract` / `code` / `xdotool` / `xclip` / `wl-paste` /
    `gnome-screenshot` for the current platform.
  - **Fixed CalendarReadCollector bug**: `nextEvent.start` could be undefined
    (all-day events / missing start) — now guarded (also cleared a type error).
  - **Env load order**: `src/loadEnv.ts` imported first so `API_TOKEN` /
    `GEMINI_API_KEY` are populated before config reads them; auth token is now
    read per-request. Whole project typechecks clean (`tsc --noEmit`).

- **2026-07-15** — P0 security fixes landed: API-token auth middleware +
  CORS allowlist, `execFile`/`fs`-based action execution (no shell strings),
  Gmail header sanitization, browser URL allowlist, session-scoped
  confirmation state, `browser_fill` no longer echoes values, `.env.example`
  added, duplicate `ActionExecutor` case removed.
</content>
