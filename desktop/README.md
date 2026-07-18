# KashinAI2 — macOS desktop app (Tauri)

A thin native shell that **bundles the KashinAI2 engine** (the Node backend) and
runs it locally, so a tester can install one `.app` instead of running a server
by hand. The engine is spawned as a child process; its data (SQLite DB, LanceDB
index, Google token) lives in the app's data directory, and the window shows the
usual dashboard once the engine is up. A menubar tray provides Open / Quit.

> Status: **foundation scaffold.** The `.app`/`.dmg` must be built on macOS
> (see prerequisites) — it has not been built end-to-end from the CI sandbox, so
> expect to iterate on the first local build.

## Prerequisites (on the Mac)

- **Node 22+** (`brew install node`) — the app spawns your system `node`, or set
  `KASHINAI_NODE=/path/to/node`. (Shipping a bundled Node runtime is a planned
  follow-up.)
- **Rust** (`https://rustup.rs`) and **Xcode Command Line Tools** (`xcode-select --install`).

## Develop / build

```bash
cd desktop
npm install                 # Tauri CLI
npm run dev                 # generates icons, bundles the engine, runs the app (hot-reload shell)
# or a release build:
npm run build               # produces src-tauri/target/release/bundle/dmg/*.dmg
```

`npm run bundle-engine` stages `dist/`, `public/`, `prisma/`, `package.json`, and
**production `node_modules` (native, for this Mac)** plus `launch.mjs` into
`src-tauri/resources/engine/`, which Tauri bundles into the `.app`.

## Configuration at runtime

The engine reads its usual env vars. On first launch a stable `API_TOKEN` is
generated and stored in the app-data dir. To use `/chat`, set your Gemini key —
either export `GEMINI_API_KEY` before launching, or add it to a `.env` you place
next to the bundled engine. (A settings UI for keys is a planned follow-up.)

## CI

`.github/workflows/desktop.yml` builds the app on `macos-latest` on a version tag
(or manual dispatch) and uploads the `.dmg` as an artifact / attaches it to the
release. The artifact is **unsigned** — add Apple Developer signing +
notarization secrets and the matching Tauri config to distribute it to others
without Gatekeeper warnings.
