// src/memory/instance.ts
//
// Single shared MemoryService for the whole process. Previously app.ts and
// server.ts each did `new MemoryService()`, which loaded the embedding model
// and opened a second LanceDB connection twice — and split writers (collectors)
// from readers (HTTP API) across two instances. Importing this shared instance
// everywhere keeps one embedding model + one vector DB connection.

import { MemoryService } from './MemoryService';

export const memoryService = new MemoryService();
