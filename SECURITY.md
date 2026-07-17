# Security & trust model

KashinAI2 is **local-first**: it continuously captures your activity and can act
on your behalf (send email, post to Slack, create issues, run browser
automation). Treat the backend and its stores as **highly sensitive**.

## Trust boundary

- **The API token is the boundary.** State-changing routes (`/chat`,
  `/chat/stream`, `/actions/execute`, `/memory/store`, `/voice/query`, dashboard
  writes) require a valid token (`API_TOKEN` or a per-device token in
  `API_TOKENS`). Read-only routes (`/health`, `/ready`, `/metrics`,
  `/context/*`, `/memory/search`, `/`) are unauthenticated by design for local
  use — they still expose your captured context, so do **not** expose them
  publicly without a proxy + auth.
- CORS cannot protect the action layer (the browser extension's injected script
  runs in the visited page's origin). The token is the real defense.

## Do / Don't

- **Do** set `API_TOKEN` (or `API_TOKENS`) before using beyond `localhost`.
- **Do** keep the backend off the public internet unless it's behind a TLS
  reverse proxy (see `docker-compose.yml` + `Caddyfile`).
- **Do** rotate/revoke device tokens by editing `API_TOKENS` and restarting.
- **Don't** publish the port directly. **Don't** disable secret redaction
  (`DISABLE_SECRET_REDACTION`) unless you understand the exposure.

## Remote / multi-device access

Personal multi-device use means reaching the backend from your phone/laptop.
Do it over HTTPS with a per-device token:

1. Run behind TLS: `docker compose up -d` (Caddy terminates TLS; the app port is
   not published). For a real hostname, set `DOMAIN` (and it gets a Let's Encrypt
   cert automatically); `localhost` gets an internal cert.
2. Give each device its own token via `API_TOKENS=laptop:…,phone:…`.
3. Restrict browser origins with `ALLOWED_ORIGINS` and tune `RATE_LIMIT_*`.

### Suggested production presets (`.env`)

```env
API_TOKENS=laptop:<random>,phone:<random>
ALLOWED_ORIGINS=https://kashinai.example.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
LOG_LEVEL=info
```

## Data at rest

Captured context lives in local SQLite (`dev.db`) and LanceDB (`lancedb/`).
Secrets are redacted on capture (best-effort), and `CAPTURE_EXCLUDE_APPS` pauses
capture while sensitive apps are focused — but the stores remain sensitive.
Back them up and dispose of them like personal data.

## Reporting

This is a personal project; open a GitHub issue for security concerns (avoid
posting secrets or tokens in the report).
