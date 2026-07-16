# KashinAI VS Code Companion

Reports the active editor's **cursor position** and **selected code** to the
local KashinAI backend, so the assistant can answer questions like "what's
selected?" / "where is my cursor?" — the two features that were previously
stubbed on the backend.

## How it works

On selection / active-editor change, the extension POSTs to
`{backendUrl}/vscode/state`:

```json
{ "file": "/path/to/file.ts", "line": 42, "column": 8, "selectedText": "…" }
```

The backend keeps the latest state (treated as stale after 30s) and serves it
from the `vscode_get_cursor_position` and `vscode_read_selected_code` tools.

## Setup

1. Build: `npm install && npm run compile` in this folder.
2. Launch the extension (F5 in VS Code) or package it with `vsce package`.
3. In VS Code settings, set:
   - `kashinai.backendUrl` (default `http://localhost:3001`)
   - `kashinai.apiToken` — must match the backend's `API_TOKEN`.

Reporting is best-effort: if the backend is down, the editor is never disrupted.
