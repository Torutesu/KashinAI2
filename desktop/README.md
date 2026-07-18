# KashinAI2 — macOS desktop app (Tauri)

A thin native shell that **bundles the KashinAI2 engine** (the Node backend) and
runs it locally, so a tester can install one `.app` instead of running a server
by hand. The engine is spawned as a child process; its data (SQLite DB, LanceDB
index, Google token) lives in the app's data directory, and the window shows the
usual dashboard once the engine is up. A menubar tray provides Open / Quit.

> Status: **the Rust compiles** (`cargo check` passes) and `tauri icon` /
> `bundle-engine.sh` are verified. The full `.app`/`.dmg` bundling step must run
> on macOS (see prerequisites) and hasn't been exercised end-to-end yet, so
> expect to iterate on the first macOS build.

**End users need nothing preinstalled** — a matching Node runtime is bundled into
the `.app` (the build step downloads the Node version/arch that built the native
modules, so their ABI matches). A system `node` (or `KASHINAI_NODE`) is only a
fallback if the bundled runtime is missing.

## Prerequisites (on the build Mac only)

- **Node 22+** (`brew install node`) — builds the engine and is bundled into the app.
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
generated and stored in the app-data dir. To use `/chat`, set your Gemini key
**right in the dashboard** — the "API keys" panel (enter the app's token first,
shown once you paste `API_TOKEN`) saves it to the app-data settings store and
applies it without a restart. No env editing required.

## CI

`.github/workflows/desktop.yml` builds the app on `macos-latest` on a version tag
(or manual dispatch) and uploads the `.dmg` as an artifact / attaches it to the
release. The artifact is **unsigned** — add Apple Developer signing +
notarization secrets and the matching Tauri config to distribute it to others
without Gatekeeper warnings.
