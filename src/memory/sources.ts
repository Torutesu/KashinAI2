// src/memory/sources.ts
//
// Canonical list of memory sources that can be individually cleared. Kept in a
// dependency-free module so route handlers can validate against it without
// importing the (heavy) MemoryService/embedding stack.

export const CLEARABLE_SOURCES = [
  'CLIPBOARD', 'BROWSER', 'SELECTED_TEXT', 'SLACK', 'CALENDAR', 'APP_ACTIVITY', 'VSCODE', 'OCR',
] as const;

export type ClearableSource = (typeof CLEARABLE_SOURCES)[number];
