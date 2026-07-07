import express from 'express';
import cors from 'cors';
import { MemoryService } from './memory/MemoryService';
import { RetrieverService } from './retriever/RetrieverService';
import { GeminiProvider } from './llm/GeminiProvider';
import { OrchestratorService } from './llm/OrchestratorService';

const app = express();
app.use(cors());
app.use(express.json());

// Dependency Injection
const memoryService = new MemoryService();
const retrieverService = new RetrieverService(memoryService);

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY is missing or empty — check your .env file.');
}

const llmProvider = new GeminiProvider(process.env.GEMINI_API_KEY || '');
const orchestratorService = new OrchestratorService(retrieverService, llmProvider);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/context/current', async (req, res) => {
  const context = await memoryService.getRecentContext(1);
  res.json(context);
});

app.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const response = await orchestratorService.processPrompt(prompt);
    res.json({ response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'LLM processing failed' });
  }
});

export default app;