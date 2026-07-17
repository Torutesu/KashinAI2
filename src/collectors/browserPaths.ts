// src/collectors/browserPaths.ts
//
// Pure helpers for locating Chromium-based browser history databases across
// browsers (Chrome, Chromium, Edge, Brave) and profiles (Default, Profile N).
// Filesystem access is injected so this is unit testable.

import path from 'path';

export interface BrowserSpec {
  name: string;
  userDataDir: string;
}

/** User-data directories for known Chromium browsers on this platform. */
export function browserUserDataDirs(platform: NodeJS.Platform, home: string): BrowserSpec[] {
  const dirs: BrowserSpec[] = [];
  const add = (name: string, ...segs: string[]) => dirs.push({ name, userDataDir: path.join(home, ...segs) });

  if (platform === 'darwin') {
    add('Chrome', 'Library', 'Application Support', 'Google', 'Chrome');
    add('Chromium', 'Library', 'Application Support', 'Chromium');
    add('Edge', 'Library', 'Application Support', 'Microsoft Edge');
    add('Brave', 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser');
  } else if (platform === 'win32') {
    add('Chrome', 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    add('Edge', 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
    add('Brave', 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data');
  } else if (platform === 'linux') {
    add('Chrome', '.config', 'google-chrome');
    add('Chromium', '.config', 'chromium');
    add('Edge', '.config', 'microsoft-edge');
    add('Brave', '.config', 'BraveSoftware', 'Brave-Browser');
  }
  return dirs;
}

/** History DB paths for every profile (Default, Profile N) under a user-data dir. */
export function profileHistoryPaths(
  userDataDir: string,
  listDir: (dir: string) => string[],
  exists: (p: string) => boolean
): string[] {
  if (!exists(userDataDir)) return [];
  let entries: string[];
  try {
    entries = listDir(userDataDir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => e === 'Default' || /^Profile /.test(e))
    .map((profile) => path.join(userDataDir, profile, 'History'))
    .filter(exists);
}
