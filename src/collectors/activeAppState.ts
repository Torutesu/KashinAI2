// src/collectors/activeAppState.ts
//
// Shared "which app is focused right now" state + a per-app capture-exclusion
// rule. ActiveWindowCollector updates the current app; other collectors consult
// isCurrentAppExcluded() so nothing is captured while a sensitive app (password
// manager, banking, etc.) is in the foreground.
//
// The exclude list is held in memory (seeded from CAPTURE_EXCLUDE_APPS) so the
// dashboard can edit it live; the Setting store persists it across restarts.

let currentApp = '';
let excludeApps = process.env.CAPTURE_EXCLUDE_APPS || '';

export function setCurrentApp(app: string): void {
  currentApp = app || '';
}

export function getCurrentApp(): string {
  return currentApp;
}

/** Comma-separated exclude list (as configured). */
export function getExcludeApps(): string {
  return excludeApps;
}

/** Replace the exclude list at runtime (dashboard edit). */
export function setExcludeApps(csv: string): void {
  excludeApps = csv || '';
}

/** True if `app` matches any exclude term. Pure (defaults to the live list). */
export function isCaptureExcluded(app: string, csv: string = excludeApps): boolean {
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
