// src/server.ts
import './loadEnv'; // must be first — populates process.env before app/config load
import app from './app';
import { ActiveWindowCollector } from './collectors/ActiveWindowCollector';
import { ClipboardCollector } from './collectors/ClipboardCollector';
import { BrowserHistoryCollector } from './collectors/BrowserHistoryCollector';
import { SelectedTextCollector } from './collectors/SelectedTextCollector';
import { SlackReadCollector } from './collectors/SlackReadCollector';
import { CalendarReadCollector } from './collectors/CalendarReadCollector';
import { VSCodeCollector } from './collectors/VSCodeCollector';
import { ScreenOCRCollector } from './collectors/ScreenOCRCollector';
import { memoryService } from './memory/instance';
import { WhisperService } from './voice/WhisperService'; // ⬅️ NEW
import { checkExternalBinaries } from './utils/binaryCheck';
import { assertValidConfig } from './config';
import { log } from './utils/logger';

// Validate configuration before anything else (throws on hard errors).
assertValidConfig();

const PORT = process.env.PORT || 3001;

// Warn early about any missing external tools the collectors/actions rely on.
checkExternalBinaries();

// Shared singleton MemoryService (imported from ./memory/instance)

// Initialize Collectors
const collectors = [
  new ActiveWindowCollector(memoryService),
  new ClipboardCollector(memoryService),
  new BrowserHistoryCollector(memoryService),
  new SelectedTextCollector(memoryService),
  new SlackReadCollector(memoryService),
  new CalendarReadCollector(memoryService),
  new VSCodeCollector(memoryService),
  new ScreenOCRCollector(memoryService)
];

log.info('Starting background collectors...');
collectors.forEach(c => c.start());

// Retention policy: periodically prune memories older than MEMORY_RETENTION_DAYS
// (default 30; set to 0 to disable) so the local stores don't grow unbounded.
const RETENTION_DAYS = parseInt(process.env.MEMORY_RETENTION_DAYS || '30', 10);
let pruneTimer: NodeJS.Timeout | null = null;
if (RETENTION_DAYS > 0) {
  const runPrune = () => { void memoryService.pruneOldMemories(RETENTION_DAYS); };
  // Delay the first run so the vector DB has time to connect, then every 6h.
  const firstPrune = setTimeout(runPrune, 60000);
  firstPrune.unref?.();
  pruneTimer = setInterval(runPrune, 6 * 60 * 60 * 1000);
}

app.listen(PORT, () => {
  log.info(`AI Context Engine running on http://localhost:${PORT}`);
});

WhisperService.preload().catch((err) => {
  log.warn('[Server] Whisper model preload failed, will retry on first /voice/query request:', err?.message || err);
});

process.on('SIGINT', () => {
  log.info('Shutting down collectors...');
  collectors.forEach(c => c.stop());
  if (pruneTimer) clearInterval(pruneTimer);
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  log.error('Unhandled Rejection:', err);
});