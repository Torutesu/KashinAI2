# Changelog

All notable changes to KashinAI2 are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-07-17

### Added
- **Web dashboard**: a read-only monitoring UI served at `/` (from `public/`) —
  live readiness, metrics counters, recent activity timeline, and semantic
  memory search. Self-contained (no build step, theme-aware).
- **`GET /version`** endpoint (`{ name, version }`), used by the dashboard header.

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
