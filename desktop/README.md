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
release.

## Signing & notarization

Without signing, the `.dmg` runs but Gatekeeper warns other users (they must
right-click → Open, or `xattr -cr` it). To ship a signed + notarized build,
add these **repo secrets** (Settings → Secrets and variables → Actions) — the
CI workflow signs and notarizes automatically when they're present, and stays
unsigned when they're not:

| Secret | What it is |
|--------|------------|
| `APPLE_CERTIFICATE` | base64 of your **Developer ID Application** cert `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | the password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` (`security find-identity -v -p codesigning`) |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | an **app-specific password** from appleid.apple.com |
| `APPLE_TEAM_ID` | your 10-character Team ID |

`entitlements.plist` grants the bundled Node runtime what it needs under the
hardened runtime (JIT, executable memory, and loading the unsigned native
`.node` modules via disabled library validation).

> **Known caveat (bundled Node):** notarization scans every Mach-O in the bundle,
> so the bundled `node` binary and each native `*.node` / `*.dylib` under
> `Resources/engine` must also be signed with the hardened runtime. Tauri signs
> the app bundle; if notarization is rejected for an unsigned nested binary,
> we'll add a pre-sign pass over `Resources/engine`. This step is best finalized
> against a real Apple account (it can't be tested without one).
