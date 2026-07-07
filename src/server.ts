import dotenv from 'dotenv';
dotenv.config(); 

import app from './app';
import { ActiveWindowCollector } from './collectors/ActiveWindowCollector';
import { ClipboardCollector } from './collectors/ClipboardCollector';
import { MemoryService } from './memory/MemoryService';

const PORT = process.env.PORT || 3001;

// Start Memory & Collectors
const memoryService = new MemoryService();
const activeWindowCollector = new ActiveWindowCollector(memoryService);
const clipboardCollector = new ClipboardCollector(memoryService);

console.log('Starting background collectors...');
activeWindowCollector.start();
clipboardCollector.start();

// Start Server
app.listen(PORT, () => {
  console.log(`AI Context Engine running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down collectors...');
  activeWindowCollector.stop();
  clipboardCollector.stop();
  process.exit(0);
});