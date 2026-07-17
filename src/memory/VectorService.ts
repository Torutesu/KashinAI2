// src/memory/VectorService.ts
import { log } from '../utils/logger';
import * as lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';

export class VectorService {
  private db: any;
  private extractor: any;
  private isConnected: boolean = false;
  private initPromise: Promise<void> | null = null;
  private readonly TABLE_NAME = 'memory_vectors';
  private readonly TOOL_TABLE_NAME = 'tool_vectors';

  /** True once LanceDB + the embedding model are ready. */
  get connected(): boolean {
    return this.isConnected;
  }

  async initialize(): Promise<void> {
    if (this.isConnected) return;
 
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // 1. Initialize local embedding model (runs privately on CPU)
      log.info('[VectorService] Loading embedding model (first run may take a minute to download)...');
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
      log.info('[VectorService] Connected to LanceDB and model ready.');
    } catch (error) {
      log.error('[VectorService] Initialization failed:', error);
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
      log.error('[VectorService] Store memory failed:', error);
    }
  }

  /**
   * Delete stored memory vectors older than the given ISO cutoff. The INIT seed
   * row and the tool index are preserved. Returns how many rows were removed.
   * `isoCutoff` is generated internally from a Date, so it's safe to inline.
   */
  async pruneOlderThan(isoCutoff: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const tables = await this.db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) return 0;

      const table = await this.db.openTable(this.TABLE_NAME);
      const before = await table.countRows();
      await table.delete(`timestamp < '${isoCutoff}' AND type != 'INIT'`);
      const after = await table.countRows();
      return Math.max(0, before - after);
    } catch (error) {
      log.error('[VectorService] Prune failed:', error);
      return 0;
    }
  }

  /** Delete all memory vectors of a given type. Returns rows removed. */
  async deleteByType(type: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const tables = await this.db.tableNames();
      if (!tables.includes(this.TABLE_NAME)) return 0;
      const table = await this.db.openTable(this.TABLE_NAME);
      const before = await table.countRows();
      // `type` comes from a fixed validated set, so inlining is safe.
      await table.delete(`type = '${type}'`);
      const after = await table.countRows();
      return Math.max(0, before - after);
    } catch (error) {
      log.error('[VectorService] deleteByType failed:', error);
      return 0;
    }
  }

  async searchMemory(query: string, limit: number = 3): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const queryVector = await this.generateEmbedding(query);
      const table = await this.db.openTable(this.TABLE_NAME);

      // Perform vector search
      const results = await table.search(queryVector).limit(limit).toArray();

      // Filter out the initialization record and return
      return results.filter((r: any) => r.text !== 'initialize');
    } catch (error) {
      log.error('[VectorService] Search memory failed:', error);
      return [];
    }
  }

  async initToolIndex(tools: { name: string; text: string }[]): Promise<void> {
    if (!this.isConnected) {
      log.warn('[VectorService] Cannot build tool index — not connected yet.');
      return;
    }
    try {
      const tables = await this.db.tableNames();

      if (tables.includes(this.TOOL_TABLE_NAME)) {
        const existing = await this.db.openTable(this.TOOL_TABLE_NAME);
        const existingCount = await existing.countRows();
        if (existingCount === tools.length) {
          // Assume unchanged — skip re-embedding every startup.
          return;
        }
        await this.db.dropTable(this.TOOL_TABLE_NAME);
        log.info('[VectorService] Tool count changed — rebuilding tool index.');
      }

      const rows = [];
      for (const t of tools) {
        const vector = await this.generateEmbedding(t.text);
        rows.push({ vector, name: t.name, text: t.text });
      }
      await this.db.createTable(this.TOOL_TABLE_NAME, rows);
      log.info(`[VectorService] Built tool index with ${rows.length} tools.`);
    } catch (error) {
      log.error('[VectorService] Tool index init failed:', error);
    }
  }

  async searchTools(query: string, limit: number = 6): Promise<{ name: string; distance: number }[]> {
    if (!this.isConnected) return [];
    try {
      const tables = await this.db.tableNames();
      if (!tables.includes(this.TOOL_TABLE_NAME)) return [];

      const queryVector = await this.generateEmbedding(query);
      const table = await this.db.openTable(this.TOOL_TABLE_NAME);
      const results = await table.search(queryVector).limit(limit).toArray();

      return results.map((r: any) => ({ name: r.name, distance: r._distance }));
    } catch (error) {
      log.error('[VectorService] Tool search failed:', error);
      return [];
    }
  }
}