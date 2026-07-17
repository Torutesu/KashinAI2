// src/app.ts
import { log } from './utils/logger';
import './loadEnv'; // must be first — populates process.env before config reads it
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { memoryService } from './memory/instance';
import { RetrieverService } from './retriever/RetrieverService';
import { createLLMProvider } from './llm/providerFactory';
import { OrchestratorService } from './llm/OrchestratorService';
import { createChatStreamHandler } from './llm/chatStream';
import { ActionExecutor } from './actions/ActionExecutor';
import { createVoiceRoutes } from './voice/VoiceRoutes'; //
import { getToolEmbeddingCorpus } from './llm/Toolregistry';
import { requireApiToken, corsOriginCheck } from './middleware/auth';
import { createRateLimiter } from './middleware/rateLimit';
import { PrismaConversationStore } from './memory/PrismaConversationStore';
import { setVSCodeLiveState } from './integrations/vscodeLiveState';
import { metricsHandler, createReadyHandler, createVersionHandler } from './routes/ops';

// Resolve the app version once (cwd is the project root in all run modes).
let APP_VERSION = '0.0.0';
try {
  APP_VERSION = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')).version || APP_VERSION;
} catch { /* keep default */ }

const app = express();
app.use(cors({ origin: corsOriginCheck }));

// Basic per-IP rate limiting (configurable via RATE_LIMIT_* env vars).
app.use(createRateLimiter());

// Limit payload size to 1mb to prevent crashing
app.use(express.json({ limit: '1mb' }));

// Read-only monitoring dashboard (served from ./public).
app.use(express.static(path.join(process.cwd(), 'public')));

// Dependency Injection (Singletons) — memoryService is shared process-wide.
const retrieverService = new RetrieverService(memoryService);
const llmProvider = createLLMProvider();
const orchestratorService = new OrchestratorService(
  retrieverService,
  llmProvider,
  memoryService,
  new PrismaConversationStore()
);
const actionExecutor = new ActionExecutor();

(async () => {
  try {
    await memoryService.vectorService.initialize();
    await memoryService.initToolIndex(getToolEmbeddingCorpus());
    log.info('[app] Tool vector index ready.');
  } catch (error) {
    log.error('[app] Tool vector index bootstrap failed — will keep using keyword-based tool selection:', error);
  }
})();

// Basic validation middleware
const validateBody = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Request body is required' });
  }
  next();
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Operational endpoints (unauthenticated, read-only).
app.get('/ready', createReadyHandler(() => memoryService.isReady()));
app.get('/metrics', metricsHandler);
app.get('/version', createVersionHandler(APP_VERSION));

// --- Context APIs ---
app.get('/context/current', async (req: Request, res: Response) => {
  const context = await memoryService.getRecentContext(1);
  res.json(context);
});

app.get('/context/recent', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const context = await memoryService.getRecentContext(limit);
  res.json(context);
});

// --- Retrieval API ---
app.post('/retrieve', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  const context = await retrieverService.retrieveContext(prompt);
  res.json({ context });
});

// --- Chat / Orchestration API ---
app.post('/chat', requireApiToken, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt is required and must be a string' });
    if (prompt.length > 5000) return res.status(400).json({ error: 'Prompt is too long (max 5000 characters)' });

    // Confirmation state is scoped per session so concurrent callers don't mix.
    const sessionId = (req.get('x-session-id') || (typeof req.body.sessionId === 'string' ? req.body.sessionId : '') || 'default').slice(0, 128);
    const response = await orchestratorService.processPrompt(prompt, sessionId);
    res.json({ response });
  } catch (error) {
    log.error('[Server] /chat error:', error);
    res.status(500).json({ error: 'LLM processing failed' });
  }
});

// --- Streaming Chat API (Server-Sent Events) ---
app.post('/chat/stream', requireApiToken, createChatStreamHandler(orchestratorService));

// --- Direct Action Execution API ---
app.post('/actions/execute', requireApiToken, validateBody, async (req: Request, res: Response) => {
  const { toolName, args } = req.body;
  if (!toolName) return res.status(400).json({ error: 'toolName is required' });
  const result = await actionExecutor.execute(toolName, args || {});
  res.json({ result: result.message, ok: result.ok });
});

// --- Memory APIs ---
app.get('/memory/search', async (req: Request, res: Response) => {
  const query = req.query.query as string;
  if (!query) return res.status(400).json({ error: 'query parameter is required' });
  const results = await memoryService.searchMemory(query);
  res.json(results);
});

app.post('/memory/store', requireApiToken, validateBody, async (req: Request, res: Response) => {
  const { type, content, app: appName, window } = req.body;
  if (!type || !content) return res.status(400).json({ error: 'type and content are required' });
  await memoryService.storeEvent({ type, content, app: appName, window, timestamp: new Date() });
  res.json({ status: 'success', message: 'Memory stored successfully' });
});

// --- Raw LLM Query API ---
app.post('/llm/query', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  try {
    // Calls LLM directly with context but WITHOUT tools/actions
    const context = await retrieverService.retrieveContext(prompt);
    const response = await llmProvider.generateResponse(prompt, context, [], []);
    res.json({ response: response.text || 'No response generated.' });
  } catch (error) {
    res.status(500).json({ error: 'LLM query failed' });
  }
});

// --- VS Code companion: receive live editor state (cursor + selection) ---
app.post('/vscode/state', requireApiToken, (req: Request, res: Response) => {
  const { file, line, column, selectedText } = req.body || {};
  setVSCodeLiveState({
    file: typeof file === 'string' ? file : undefined,
    line: typeof line === 'number' ? line : undefined,
    column: typeof column === 'number' ? column : undefined,
    selectedText: typeof selectedText === 'string' ? selectedText.slice(0, 10000) : undefined,
  });
  res.json({ status: 'ok' });
});

app.use('/voice', requireApiToken, createVoiceRoutes(orchestratorService));

export default app;