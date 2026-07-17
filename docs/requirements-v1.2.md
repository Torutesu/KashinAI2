# KashinAI2 v1.2 — Requirements (draft for sign-off)

Decided context (from product owner):
- **Deployment model: personal, multi-device.** One person, several devices.
  → Auth = per-device tokens for identification/revocation. **No cross-user data
  isolation required** (all data belongs to the single owner and is shared
  across their devices).
- **All four workstreams** are in scope, delivered **in order**, each as its own
  PR with tests.
- **Integrations priority: Google Drive (read) and Jira/Linear.**

Proposed implementation order (dependency-aware): **1 → 2 → 3 → 4**.

---

## 1. Multi-device tokens (auth foundation)

**Goal:** replace the single `API_TOKEN` with a set of named per-device tokens
that can be listed and revoked, while staying backward compatible.

**Scope**
- Token registry: multiple tokens, each with a label (device name) and created
  time. Source: `API_TOKENS` env (comma-separated `label:token` pairs) **plus**
  the existing single `API_TOKEN` (kept working).
- `requireApiToken` accepts any valid token; attaches the matched device label to
  the request (for logging / metrics `tool_calls_total{device=…}` — labels
  optional).
- Optional: `GET /devices` (auth) lists device labels (not the secrets).
- Revocation = remove from env + restart (no DB needed for personal use).

**Acceptance criteria**
- Any configured token authenticates; an unknown token → 401.
- Existing single-`API_TOKEN` setups keep working unchanged.
- Requests are attributable to a device label in logs.
- Unit tests for the token-matching + parsing logic.

**Non-goals:** user accounts, per-user data separation, login UI, DB-backed
token issuance (env is sufficient for one owner).

**Decision:** env-based (`API_TOKENS` list). Revoke by removing + restart. No DB.

---

## 2. Dashboard expansion

**Goal:** add safe management to the read-only dashboard.

**Scope**
- (a) **Privacy list view/edit**: view `CAPTURE_EXCLUDE_APPS`; edit persists to a
  small settings store (SQLite `Setting` table) so it survives restart.
- (b) **Action history**: show recent tool executions (needs a lightweight
  action-audit log — new `ActionLog` table written by ActionExecutor).
- (c) **Memory delete**: delete a memory entry / clear a source.
- All **write** operations require the API token (entered once in the dashboard,
  stored in `localStorage`).

**Acceptance criteria**
- Read-only view still works with no token.
- Writes without a valid token → 401; with token → succeed and are audited.
- Privacy edits take effect without a restart.
- E2E tests for the new write endpoints (auth + effect).

**Non-goals:** full SPA/framework, multi-user settings.

**Decision:** include write operations (privacy edit, memory delete, action history), token required.

---

## 3. Additional integrations

**Goal:** Google Drive (read) + Jira/Linear (issues), following the existing
`IntegrationError` + Toolregistry + HTTP-mock-test pattern.

**Scope**
- **Google Drive (read):** `gdrive_search_files`, `gdrive_read_file` (text/Docs
  export). Reuses Google OAuth (`googleClient`) with an added Drive read scope.
- **Jira:** `jira_search_issues`, `jira_read_issue`, `jira_create_issue`,
  `jira_comment_issue` (auth: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`).
- **Linear:** `linear_search_issues`, `linear_create_issue` (auth:
  `LINEAR_API_KEY`, GraphQL).
- Register tools; destructive ones (create/comment) go through the confirmation
  gate.

**Acceptance criteria**
- Each method throws `IntegrationError` on failure, returns a success string
  otherwise; guarded on missing credentials.
- HTTP-mocked unit tests per provider (guard + parse + error).
- `.env.example` documents all new credentials.

**Non-goals:** write to Drive, two-way sync, webhooks.

**Decision:** all three confirmed — Google Drive (read), Jira, Linear.

---

## 4. Mobile / remote access

**Goal:** document and preset safe remote use (personal multi-device implies
reaching the backend from phone/laptop).

**Scope**
- Docs: HTTPS via a reverse proxy (Caddy/nginx) example; token-per-device setup;
  `ALLOWED_ORIGINS` and `RATE_LIMIT_*` production presets.
- A `SECURITY.md` covering the trust model (tokens are the boundary; keep the
  backend off the public internet without a proxy + TLS).
- Optional: a `docker-compose.yml` with the app + a TLS-terminating proxy.

**Acceptance criteria**
- Clear, copy-pasteable setup that keeps the action layer authenticated over TLS.
- No code changes required beyond config; existing tests still pass.

**Non-goals:** hosted/managed service, mobile app.

**Decision:** docker-compose.yml with a bundled TLS proxy (Caddy) + SECURITY.md.

---

## Cross-cutting
- Each workstream: its own PR, `tsc` clean, tests added, CHANGELOG under
  `[1.2.0]`, ROADMAP updated.
- No breaking changes to existing single-token / local-only usage.
