// src/collectors/activeAppState.ts
//
// Shared "which app is focused right now" state + a per-app capture-exclusion
// rule. ActiveWindowCollector updates the current app; other collectors consult
// isCurrentAppExcluded() so nothing is captured while a sensitive app (password
// manager, banking, etc.) is in the foreground.
//
// Configure via CAPTURE_EXCLUDE_APPS (comma-separated, case-insensitive
// substrings matched against the app name), e.g. "1Password,Bitwarden,Keychain".

let currentApp = '';

export function setCurrentApp(app: string): void {
  currentApp = app || '';
}

export function getCurrentApp(): string {
  return currentApp;
}

/** True if `app` matches any CAPTURE_EXCLUDE_APPS term. Pure (env injectable). */
export function isCaptureExcluded(app: string, csv: string = process.env.CAPTURE_EXCLUDE_APPS || ''): boolean {
  if (!app) return false;
  const terms = csv.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return false;
  const a = app.toLowerCase();
  return terms.some((t) => a.includes(t));
}

/** True if the currently-focused app is excluded from capture. */
export function isCurrentAppExcluded(): boolean {
  return isCaptureExcluded(currentApp);
}
