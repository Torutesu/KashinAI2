// src/utils/binaryCheck.ts
//
// Collectors and actions shell out to external binaries (xdotool, tesseract,
// sqlite3, …). When one is missing the feature silently produces no data. This
// scans PATH at startup and prints a single grouped warning listing whatever is
// absent, with the feature it powers — so an operator knows why, say, OCR is
// empty without reading source.

import fs from 'fs';
import path from 'path';

/** True if `cmd` is found on PATH (honors PATHEXT on Windows). */
export function commandExists(cmd: string): boolean {
  const envPath = process.env.PATH || '';
  const dirs = envPath.split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, cmd + ext);
      try {
        if (fs.existsSync(full)) return true;
      } catch {
        // unreadable PATH entry — skip
      }
    }
  }
  return false;
}

interface BinarySpec {
  cmd: string;
  feature: string;
  platforms: NodeJS.Platform[]; // platforms where this binary is actually used
}

const BINARIES: BinarySpec[] = [
  { cmd: 'sqlite3', feature: 'browser history collector', platforms: ['darwin', 'linux', 'win32'] },
  { cmd: 'tesseract', feature: 'screen OCR collector', platforms: ['darwin', 'linux', 'win32'] },
  { cmd: 'code', feature: 'VS Code open/collector', platforms: ['darwin', 'linux', 'win32'] },
  { cmd: 'xdotool', feature: 'active window / selected text (X11)', platforms: ['linux'] },
  { cmd: 'xclip', feature: 'clipboard (X11)', platforms: ['linux'] },
  { cmd: 'wl-paste', feature: 'clipboard (Wayland)', platforms: ['linux'] },
  { cmd: 'gnome-screenshot', feature: 'screen OCR screenshot (GNOME)', platforms: ['linux'] },
];

/** Warn (once, at startup) about any missing external binary for this platform. */
export function checkExternalBinaries(): void {
  const platform = process.platform;
  const missing = BINARIES
    .filter((b) => b.platforms.includes(platform) && !commandExists(b.cmd))
    .map((b) => `  - ${b.cmd} (needed for: ${b.feature})`);

  if (missing.length > 0) {
    console.warn(
      `[startup] Some optional external tools are not on PATH — the related ` +
        `features will produce no data until installed:\n${missing.join('\n')}`
    );
  }
}
