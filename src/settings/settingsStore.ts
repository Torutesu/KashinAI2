// src/settings/settingsStore.ts
//
// Tiny key/value settings persisted in SQLite (Setting table), for dashboard-
// editable config that must survive restart (e.g. the privacy exclude list).

import { prisma } from '../db/prisma';
import { log } from '../utils/logger';

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row ? row.value : null;
  } catch (error) {
    log.error('[settings] get failed:', error);
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  } catch (error) {
    log.error('[settings] set failed:', error);
    throw error;
  }
}
