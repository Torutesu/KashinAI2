// src/integrations/vscodeLiveState.ts
//
// Holds the latest live editor state pushed by the KashinAI VS Code companion
// extension (POST /vscode/state). Node can't reach into the VS Code process, so
// the extension reports cursor position + selected text here; VSCodeIntegration
// reads it to answer the previously-stubbed live queries. Treated as stale after
// STALE_MS so we don't report an editor state the user has since moved on from.

export interface VSCodeLiveState {
  file?: string;
  line?: number;
  column?: number;
  selectedText?: string;
  updatedAt?: number;
}

const STALE_MS = 30_000;

let state: VSCodeLiveState = {};

export function setVSCodeLiveState(next: VSCodeLiveState): void {
  state = { ...next, updatedAt: Date.now() };
}

export function getVSCodeLiveState(): VSCodeLiveState {
  return state;
}

/** True if the last reported state is recent enough to trust. */
export function isLiveStateFresh(now: number): boolean {
  return typeof state.updatedAt === 'number' && now - state.updatedAt < STALE_MS;
}
