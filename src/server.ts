// src/server.ts
import dotenv from 'dotenv';
import app from './app';
import { ActiveWindowCollector } from './collectors/ActiveWindowCollector';
import { ClipboardCollector } from './collectors/ClipboardCollector';
import { MemoryService } from './memory/MemoryService';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Shared singletons
const memoryService = new MemoryService();
const activeWindowCollector = new ActiveWindowCollector(memoryService);
const clipboardCollector = new ClipboardCollector(memoryService);

console.log('Starting background collectors...');
activeWindowCollector.start();
clipboardCollector.start();

app.listen(PORT, () => {
  console.log(`AI Context Engine running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down collectors...');
  activeWindowCollector.stop();
  clipboardCollector.stop();
  process.exit(0);
});

// Catch unhandled rejections so the server doesn't crash
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});