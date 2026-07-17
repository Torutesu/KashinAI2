# Deploying KashinAI2 with a public URL (Cloudflare Tunnel)

KashinAI2 is a stateful local-first service (SQLite, LanceDB, a local embedding
model, optional Playwright/OS collectors). It **cannot** run on Cloudflare
Workers/Pages (V8 isolates: no filesystem, no native modules, no long-running
server). Instead, run the app on your machine (or a small VM) and put a
**Cloudflare Tunnel** in front of it — Cloudflare gives you a public HTTPS URL
and terminates TLS, without opening any ports.

## Before you expose it publicly

A public URL means anyone who finds it can reach the API. Two things are
mandatory:

1. **Set a token.** `API_TOKEN` (or per-device `API_TOKENS`) — the action layer
   is now reachable from the internet.
2. **Gate reads too.** `REQUIRE_AUTH_ALL=true` (already set in
   `docker-compose.cloudflare.yml`) so `/context/*`, `/memory/search`,
   `/metrics`, etc. require the token as well. Without this, your captured
   context would be world-readable.

See [`SECURITY.md`](./SECURITY.md) for the full trust model.

## Named tunnel (stable URL) — recommended

1. In **Cloudflare Zero Trust → Networks → Tunnels**, create a tunnel and copy
   its **token**.
2. Add a **public hostname** to the tunnel (e.g. `kashinai.example.com`) routed
   to the service **`http://app:3001`** (that's the compose service name/port).
3. Configure `.env`:
   ```env
   API_TOKENS=laptop:<random>,phone:<random>
   GEMINI_API_KEY=...
   TUNNEL_TOKEN=<the tunnel token>
   ```
4. Start:
   ```bash
   docker compose -f docker-compose.cloudflare.yml up -d
   ```
5. Open `https://kashinai.example.com/`, paste a token into the dashboard's
   token field, and it connects. API calls:
   ```bash
   curl https://kashinai.example.com/chat \
     -H "x-api-token: <token>" -H "Content-Type: application/json" \
     -d '{"prompt":"what am I working on?"}'
   ```

## Quick tunnel (ephemeral URL, for testing)

No Cloudflare account needed — prints a random `*.trycloudflare.com` URL:

```bash
# with the app already running on :3001
docker run --rm --network host cloudflare/cloudflared:latest \
  tunnel --url http://localhost:3001
```

Still set `API_TOKEN`/`REQUIRE_AUTH_ALL` — the quick URL is public too.

## Notes

- The desktop collectors (clipboard, window, OCR, browser history) only make
  sense on your own machine; on a headless VM they warn and stay idle, while the
  chat/RAG/action API and integrations work normally.
- DB migrations run automatically on container start (`prisma migrate deploy`).
