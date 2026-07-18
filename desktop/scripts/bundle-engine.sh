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

echo "[bundle-engine] done -> $DEST"
