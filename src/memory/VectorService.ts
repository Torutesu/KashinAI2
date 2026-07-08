// src/memory/VectorService.ts
import * as lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';

export class VectorService {
  private db: any;
  private extractor: any;
  private isConnected: boolean = false;
  private readonly TABLE_NAME = 'memory_vectors';

  async initialize() {
    if (this.isConnected) return;
    
    try {
      // 1. Initialize local embedding model (runs privately on CPU)
      console.log('[VectorService] Loading embedding model (first run may take a minute to download)...');
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      // 2. Connect to local LanceDB
      this.db = await lancedb.connect('./lancedb');
      
      // Check if table exists, if not, create it
      const tables = await this.db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) {
        // LanceDB needs an initial record to infer the schema
        const initialVector = await this.generateEmbedding('initialize');
        await this.db.createTable(this.TABLE_NAME, [
          { vector: initialVector, text: 'initialize', type: 'INIT', timestamp: new Date().toISOString() }
        ]);
      }
      
      this.isConnected = true;
      console.log('[VectorService] Connected to LanceDB and model ready.');
    } catch (error) {
      console.error('[VectorService] Initialization failed:', error);
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async storeMemory(text: string, type: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      const vector = await this.generateEmbedding(text);
      const table = await this.db.openTable(this.TABLE_NAME);
      await table.add([
        { vector, text, type, timestamp: new Date().toISOString() }
      ]);
    } catch (error) {
      console.error('[VectorService] Store memory failed:', error);
    }
  }

  async searchMemory(query: string, limit: number = 3): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const queryVector = await this.generateEmbedding(query);
      const table = await this.db.openTable(this.TABLE_NAME);
      
      // Perform vector search
      const results = await table.search(queryVector).limit(limit).execute();
      
      // Filter out the initialization record and return
      return results.filter((r: any) => r.text !== 'initialize');
    } catch (error) {
      console.error('[VectorService] Search memory failed:', error);
      return [];
    }
  }
}