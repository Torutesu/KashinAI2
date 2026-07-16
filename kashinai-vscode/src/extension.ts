// kashinai-vscode/src/extension.ts
//
// Minimal VS Code companion: pushes the active editor's cursor position and
// selected text to the local KashinAI backend whenever the selection or active
// editor changes. The backend (POST /vscode/state) exposes this to the LLM so
// "what am I looking at / what's selected" work without polling internal files.

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const report = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const cfg = vscode.workspace.getConfiguration('kashinai');
    const backendUrl = cfg.get<string>('backendUrl', 'http://localhost:3001');
    const token = cfg.get<string>('apiToken', '');

    const sel = editor.selection;
    const body = {
      file: editor.document.uri.fsPath,
      line: sel.active.line + 1, // 1-based for humans
      column: sel.active.character,
      selectedText: editor.document.getText(sel),
    };

    try {
      await fetch(`${backendUrl}/vscode/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-api-token': token } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Backend may be down — reporting is best-effort, never disrupt the editor.
    }
  };

  // Debounce rapid selection changes to avoid flooding the backend.
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void report(), 250);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(schedule),
    vscode.window.onDidChangeActiveTextEditor(schedule)
  );

  // Report once on startup.
  void report();
}

export function deactivate() {
  // nothing to clean up beyond the disposables registered above
}
