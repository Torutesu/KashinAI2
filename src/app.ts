// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MemoryService } from './memory/MemoryService';
import { RetrieverService } from './retriever/RetrieverService';
import { GeminiProvider } from './llm/GeminiProvider';
import { OrchestratorService } from './llm/OrchestratorService';

const app = express();
app.use(cors());

// Limit payload size to 1mb to prevent crashing
app.use(express.json({ limit: '1mb' }));

// Dependency Injection (Singletons)
const memoryService = new MemoryService();
const retrieverService = new RetrieverService(memoryService);
const llmProvider = new GeminiProvider(process.env.GEMINI_API_KEY || '');
const orchestratorService = new OrchestratorService(retrieverService, llmProvider);

// Basic validation middleware
const validateChat = (req: Request, res: Response, next: NextFunction) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string' });
  }
  if (prompt.length > 5000) {
    return res.status(400).json({ error: 'Prompt is too long (max 5000 characters)' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/context/current', async (req, res) => {
  const context = await memoryService.getRecentContext(1);
  res.json(context);
});

app.post('/chat', validateChat, async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await orchestratorService.processPrompt(prompt);
    res.json({ response });
  } catch (error) {
    console.error('[Server] /chat error:', error);
    res.status(500).json({ error: 'LLM processing failed' });
  }
});

export default app;