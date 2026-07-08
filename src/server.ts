// src/server.ts
import dotenv from 'dotenv';
import app from './app';
import { ActiveWindowCollector } from './collectors/ActiveWindowCollector';
import { ClipboardCollector } from './collectors/ClipboardCollector';
import { BrowserHistoryCollector } from './collectors/BrowserHistoryCollector';
import { SelectedTextCollector } from './collectors/SelectedTextCollector';
import { SlackReadCollector } from './collectors/SlackReadCollector';
import { CalendarReadCollector } from './collectors/CalendarReadCollector';
import { VSCodeCollector } from './collectors/VSCodeCollector';
import { ScreenOCRCollector } from './collectors/ScreenOCRCollector';
import { MemoryService } from './memory/MemoryService';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Shared singletons
const memoryService = new MemoryService();

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

console.log('Starting background collectors...');
collectors.forEach(c => c.start());

app.listen(PORT, () => {
  console.log(`AI Context Engine running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down collectors...');
  collectors.forEach(c => c.stop());
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});