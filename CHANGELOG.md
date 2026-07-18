# Changelog

All notable changes to KashinAI2 are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- **CI/CD hardening**: added an ESLint quality gate (`npm run lint`) to CI, and a
  `Release` workflow that, on a `vX.Y.Z` tag push, verifies the tag matches
  `package.json`, creates a GitHub Release with notes from this changelog, and
  builds + pushes a container image to `ghcr.io`.
- **Fly.io continuous deployment**: `fly.toml` (persistent volume for SQLite +
  LanceDB, health checks, auto stop/start) and a `Deploy` workflow that ships to
  Fly.io after CI passes on `main`. LanceDB's path is now configurable via
  `LANCEDB_PATH` so it can live on the volume. See `DEPLOY.md`.

## [1.7.0] - 2026-07-18

### Added
- **Scheduled notifications** (`notify_later`): schedule a notification to fire
  after a delay (1 minute–24 hours), e.g. "remind me in 30 minutes". Fans out to
  the same channels as `notify` with the same title/level formatting. In-process
  and transient — pending reminders are lost on restart.
- **Reminder management** (`notify_list`, `notify_cancel`): list the pending
  scheduled notifications (soonest first, with their ids) and cancel one by id.
- **Scheduled reminders on the dashboard**: a token-gated `GET /scheduled`
  endpoint and a "Scheduled reminders" panel showing pending `notify_later`
  reminders with their id and time-to-fire.

### Changed
- **Resilient startup**: the local ML stack (`@xenova/transformers` and its native
  `sharp` dependency) is now imported lazily by the vector/embedding and Whisper
  services instead of at module load. A missing or unbuilt native binary now
  degrades gracefully (no vector search / no voice) instead of preventing the
  whole server from starting — `/health`, `/chat`, actions, and notifications
  still come up.

## [1.6.0] - 2026-07-17

### Added
- **Channel-native notification formatting**: `notify` now accepts an optional
  `title` and `level` (`info`/`warn`/`error`). Each channel renders them in its
  own style — Telegram via HTML (bold title + severity icon), Discord via
  Markdown — instead of a single plain string. Proactive failure alerts use it
  (`error` level with the tool name as the title). Tool parameter schemas can now
  declare `enum` values.
- **Google Drive update & append** (`gdrive_update_file`, `gdrive_append_file`):
  replace the full contents of, or append plain text to, an existing Google Doc
  this app created. Both are confirmation-gated and use the same least-privileged
  `drive.file` scope as create. (Append reads the current text and re-writes;
  formatting is not preserved.)
- **Integration status endpoint** (`GET /integrations/status`, token-gated): reports
  which integrations are configured (Slack, GitHub, Google, Notion, Jira, Linear,
  Telegram, Discord) as booleans plus the names of the settings each needs — never
  any secret values. Surfaced as an "Integrations" panel on the dashboard.

## [1.5.0] - 2026-07-17

### Added
- **Google Drive write** (`gdrive_create_file`): create a new Google Doc from
  plain text and get back its shareable link. Uses the least-privileged
  `drive.file` scope (only ever touches app-created files) and is
  confirmation-gated. Re-run `src/auth/googleAuth.ts` to grant the new scope.
- **Proactive failure alerts**: with `NOTIFY_ON_TOOL_FAILURE=true`, a failed tool
  call fires a best-effort notification through the configured `notify` channels.
  Off by default; never blocks the caller and never recurses on the notification
  tools themselves.

### Changed
- **Per-device conversation history**: chat history is now namespaced by the
  authenticated device label (`device:sessionId`), so two devices sharing the
  same `x-session-id` on one backend no longer see each other's threads. Existing
  histories keyed by the bare session id won't carry over.

## [1.4.0] - 2026-07-17

### Added
- **Unified `notify` tool**: sends one message to every configured notification
  channel (Telegram, Discord) in a single call, so the assistant no longer has to
  pick a channel. Scope it with `NOTIFY_CHANNELS` (comma-separated names; blank =
  all configured). Confirmation-gated; succeeds if any channel accepts and reports
  partial failures. The channel-specific tools remain available.
- **Dashboard metrics graph**: a live SVG time-series chart of key counters
  (events stored, tool calls, tool failures) sampled every 30s, backed by a new
  `GET /metrics/history` endpoint (gated by `REQUIRE_AUTH_ALL` like `/metrics`).

## [1.3.0] - 2026-07-17

### Added
- **Public URL deployment via Cloudflare Tunnel**: `docker-compose.cloudflare.yml`
  runs the app behind a `cloudflared` tunnel (public HTTPS URL, TLS terminated by
  Cloudflare, no ports opened). `DEPLOY.md` documents named + quick tunnels.
- **Notifications**: `send_telegram_message` (Telegram Bot API) and
  `send_discord_message` (Discord webhook) — send-only, confirmation-gated. New
  env: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`.
- **Public-safe auth** (`REQUIRE_AUTH_ALL=true`): gates the read routes
  (`/context/*`, `/memory/search`, `/metrics`, `/retrieve`) with the API token
  too, so an internet-facing deployment never serves captured context
  unauthenticated. The dashboard sends the token on every request. Probes
  (`/health`, `/ready`) and the static dashboard shell stay open.

## [1.2.0] - 2026-07-17

Per-owner multi-device release (see `docs/requirements-v1.2.md`).

### Added
- **Multi-device tokens**: `API_TOKENS` (comma-separated `label:token` pairs)
  alongside `API_TOKEN`; any configured token authenticates, requests are tagged
  with the device label, and `GET /devices` lists device labels (never secrets).
  Revoke a device by removing its pair and restarting.
- **Dashboard management** (token-gated writes): edit the privacy exclude list
  (`PUT /settings/privacy`, persisted in a new `Setting` table, live effect),
  view recent action history (`GET /actions/history`), and clear a memory source
  (`POST /memory/clear`, SQLite rows + vectors). Dashboard gains a token field
  and management panels.
- **Integrations**: Google Drive (read: `gdrive_search_files`,
  `gdrive_read_file` — uses the Google OAuth `drive.readonly` scope), Jira
  (`jira_search_issues`/`read`/`create`/`comment`), and Linear
  (`linear_search_issues`/`create`). Create/comment go through the confirmation
  gate. New env: `JIRA_BASE_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN`, `LINEAR_API_KEY`.
- **Remote access**: `docker-compose.yml` + `Caddyfile` run the API behind a
  TLS-terminating Caddy proxy (auto-HTTPS; the app port is not published); the
  image now runs `prisma migrate deploy` on start. New `SECURITY.md` documents
  the trust model and per-device token setup.

## [1.1.0] - 2026-07-17

### Added
- **Web dashboard**: a read-only monitoring UI served at `/` (from `public/`) —
  live readiness, metrics counters, recent activity timeline, and semantic
  memory search. Self-contained (no build step, theme-aware).
- **`GET /version`** endpoint (`{ name, version }`), used by the dashboard header.
- **Per-app privacy exclusion** (`CAPTURE_EXCLUDE_APPS`): while a listed app
  (e.g. a password manager) is focused, collectors pause capture (clipboard,
  screen OCR, selected text, app activity).

## [1.0.0] - 2026-07-17

First hardened release. Built up from an audit of the original prototype
(see `AUDIT.md`) through security, reliability, testing, and feature work
(see `ROADMAP.md`).

### Security
- API-token auth (`x-api-token` / Bearer) on state-changing routes + CORS allowlist.
- Removed shell injection (execFile/fs, no shell strings); email-header and
  URL-scheme validation; `browser_fill` no longer echoes values.
- Secret redaction of captured clipboard / screen-OCR / selected text before storage.
- Per-IP rate limiting.

### Reliability
- Google OAuth token auto-refresh (shared client, `installed` + `web` shapes).
- Single shared `MemoryService`; startup config + binary checks.
- Leveled structured logging (`LOG_LEVEL` / `LOG_FORMAT`).
- Typed errors (`IntegrationError`) across all integrations and the action layer.
- Memory retention pruning (`MEMORY_RETENTION_DAYS`).
- Graceful shutdown (SIGINT/SIGTERM) with Prisma disconnect.

### Features
- Hybrid retrieval (vector + keyword + recency rerank).
- Durable per-session multi-turn conversation history (SQLite).
- Pluggable LLM provider (`LLM_PROVIDER=gemini|openai`, `OPENAI_BASE_URL` for
  local models).
- SSE streaming (`/chat/stream`).
- App & VS Code activity embedded with noise filtering; broader semantic recall.
- VS Code companion extension (`kashinai-vscode/`) for live cursor / selection.
- Browser history across Chrome/Chromium/Edge/Brave and all profiles, read via
  the built-in `node:sqlite` (no external `sqlite3` CLI).

### Ops
- `GET /metrics` (Prometheus) and `GET /ready` (readiness probe).
- Multi-stage `Dockerfile`.
- GitHub Actions CI (typecheck + 90+ tests). **Requires Node 22+.**
