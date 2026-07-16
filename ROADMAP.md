# KashinAI2 — Roadmap & Implementation Plan

This is the forward-looking companion to [`AUDIT.md`](./AUDIT.md). The audit's
P0–P2 items and the follow-up reliability/privacy work are **done**. This
document tracks what's still missing and lays out a phased plan for deepening
the product.

---

## 1. Where we are

Shipped so far: API-token auth + CORS, injection-safe action layer, Google
token refresh, shared MemoryService, observability, startup binary checks,
memory retention, secret redaction, per-session multi-turn history, a unit +
E2E test suite (33 tests), and CI.

The core loop works: collect → embed → retrieve → Gemini + tools → act, with a
confirmation gate on destructive actions.

---

## 2. Known gaps (not yet addressed)

### Correctness / robustness
- **Errors as strings** — *mostly addressed.* `ActionExecutor.execute` returns a
  typed `ToolResult { ok, message }`; failures now propagate as a typed
  `IntegrationError` (thrown) and are classified by exception, with the legacy
  "Error…" string convention kept as a fallback for not-yet-migrated
  integrations. The action layer's own paths (URL/dir/vscode/unknown-tool) throw
  typed errors. Remaining (mechanical): migrate each integration's guards/catches
  to throw `IntegrationError` too.
- **Gemini function-response role** — *partly addressed.* Structured tool
  results are now fed back with explicit success/failure. Remaining: use the
  SDK's real `functionCall`/`functionResponse` parts (needs a live Gemini key to
  validate the wire format) instead of the text-based round-trip.
- **VS Code live features are stubs.** `getCursorPosition` / `readSelectedCode`
  return placeholders — they need a companion VS Code extension over a local
  socket. → Build the extension + a small WS channel.
- **Collector coverage in the vector store.** `APP_ACTIVITY` and
  `VSCODE_ACTIVITY` are stored in SQLite but never embedded, so semantic search
  can't find them. → Decide policy and embed (with noise filtering).
- **Google `web` credential flow.** Refresh client supports the shape but the
  interactive `googleAuth.ts` only handles `installed`. → Unify.
- **Browser history scope.** Only Chrome's Default profile; hard `sqlite3` CLI
  dependency. → Support profiles/other browsers; read via a lib.
- **Wayland active-window** relies on GNOME `Eval` (disabled by default). →
  Use a portal or per-DE strategy.

### Product / infra
- **Multi-user / real auth model** (currently one shared token, one identity).
- ~~**Durable conversation history** (in-memory today; lost on restart).~~
  **Done** — `ConversationStore` abstraction with a SQLite-backed
  `PrismaConversationStore` (in-memory default for tests).
- ~~**Rate limiting** on the HTTP API.~~ **Done** — per-IP fixed-window limiter
  (`src/middleware/rateLimit.ts`, `RATE_LIMIT_*` env).
- ~~**Config validation** (fail fast on missing/invalid env).~~ **Done** —
  `src/config.ts` (`assertValidConfig` at startup).
- **Dockerfile + compose** for reproducible deploys.
- **Graceful shutdown flush** of pending writes; **/ready** probe.
- ~~**Structured logging** with levels, replacing console.*.~~ **Done (core)** —
  leveled logger (`LOG_LEVEL`/`LOG_FORMAT`, `src/utils/logger.ts`), adopted at
  the entry points; remaining console.* can migrate incrementally.
- **Metrics** (basic counters: events collected, tool calls, errors).

### Testing
- ~~Integration unit tests with **mocked HTTP** (Slack/GitHub/Notion/Gmail).~~
  **Done** — axios-mocked GitHub/Slack tests, Notion key-guard tests, Gmail
  header-injection tests.
- ~~Orchestrator tests with a mock `LLMProvider` (agentic loop + confirmation
  flow).~~ **Done** — tool success/failure feedback and the destructive-action
  approve/deny gate are covered.

---

## 3. Phased plan for deepening features

### Phase A — Make the core excellent (small, high-value)
1. ~~**Typed errors** at the action boundary (`ToolResult`), surfaced to the LLM
   and API.~~ **Done (boundary)** — remaining: propagate into integrations.
2. **Proper Gemini function-calling round-trip** (functionResponse parts) —
   *structured results + failure markers done; real functionResponse parts
   pending (needs a live key to validate).* 
3. **Streaming `/chat`** via SSE for responsive UX.
4. ~~**Persist conversation history** to SQLite.~~ **Done.**

### Phase B — Smarter retrieval & proactivity
5. ~~**Hybrid retrieval**: combine keyword + vector + recency, with a rerank pass.~~
   **Done** — `src/retriever/ranking.ts` merges vector + keyword candidates and
   reranks by relevance + recency (dual-source bonus); wired into RetrieverService.
6. ~~**Embed more sources** (app/vscode activity) with noise filtering.~~
   **Done** — app & VS Code activity are now embedded via a shared
   `maybeEmbed` that drops low-signal (`src/memory/noiseFilter.ts`) and
   consecutive-duplicate text; existing sources route through it too.
7. **Proactive digests**: "what did I work on today", scheduled summaries,
   surfaced suggestions based on current context.

### Phase C — Reach & extensibility
8. **VS Code companion extension** (unlocks cursor/selection features).
9. **Pluggable LLM provider** (local model option behind the `LLMProvider`
   interface; Gemini stays default).
10. **More integrations** (Jira/Linear, Telegram/Discord) and **per-app privacy
    rules** (exclude sensitive apps from capture).
11. **Web dashboard** to browse memory, review actions, and manage privacy.

---

## 4. Suggested next step

Phase A #1–#2 (typed errors + proper function-calling) give the biggest
correctness lift for the least code and unblock the rest. A good first PR:

- Add a `Result<T>` type and convert integrations + `ActionExecutor` to it.
- Rework the orchestrator to use Gemini's function-response round-trip.
- Add orchestrator confirmation-flow tests + a mock-LLM `/chat` E2E test.

_Pick a phase/item and it can be scoped into a focused PR._
