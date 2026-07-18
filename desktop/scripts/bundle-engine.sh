#!/usr/bin/env bash
#
# Stage the compiled Node engine into the Tauri resources dir so it ships inside
# the .app. Run this on the SAME OS/arch you are building the app for, because it
# installs native modules (sharp, LanceDB, onnxruntime) for that platform.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"          # repo root
DEST="$ROOT/desktop/src-tauri/resources/engine"

echo "[bundle-engine] building backend in $ROOT"
cd "$ROOT"
npm ci
npx prisma generate
npm run build

echo "[bundle-engine] staging into $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R dist "$DEST/dist"
cp -R public "$DEST/public"
cp -R prisma "$DEST/prisma"
cp package.json package-lock.json "$DEST/"
cp "$HERE/launch.mjs" "$DEST/launch.mjs"

echo "[bundle-engine] installing production dependencies (native, for this platform)"
cd "$DEST"
npm ci --omit=dev
# Prisma CLI (a devDependency) is needed at runtime for `migrate deploy`.
npm install --no-save prisma
npx prisma generate

# Bundle a Node runtime so testers don't need Node installed. Use the SAME
# version/arch that just built the native modules, so their ABI matches.
NODE_VER="$(node -p 'process.version')"                                   # e.g. v22.22.2
NODE_ARCH="$(node -p 'process.arch === "arm64" ? "arm64" : "x64"')"
NODE_PLAT="$(node -p 'process.platform')"                                 # darwin on a Mac build
NODE_PKG="node-${NODE_VER}-${NODE_PLAT}-${NODE_ARCH}"
echo "[bundle-engine] bundling Node runtime ${NODE_PKG}"
mkdir -p "$DEST/node/bin"
TARBALL="$(mktemp -t node.XXXXXX.tar.gz)"
curl -fsSL "https://nodejs.org/dist/${NODE_VER}/${NODE_PKG}.tar.gz" -o "$TARBALL"
# The darwin `node` binary is self-contained; ship just it.
tar -xzf "$TARBALL" -C "$DEST/node/bin" --strip-components=2 "${NODE_PKG}/bin/node"
rm -f "$TARBALL"
chmod +x "$DEST/node/bin/node"
"$DEST/node/bin/node" --version >/dev/null && echo "[bundle-engine] bundled node OK"

echo "[bundle-engine] done -> $DEST"
