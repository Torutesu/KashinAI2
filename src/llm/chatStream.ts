// src/llm/chatStream.ts
//
// Server-Sent Events handler for /chat/stream. Streams progress events
// (status / tool executions) emitted during the agentic loop, then a final
// `answer` event and a `[DONE]` sentinel. Factored out of app.ts so it can be
// tested with a fake orchestrator.

import { Request, Response } from 'express';

export interface StreamableOrchestrator {
  processPrompt(
    prompt: string,
    sessionId?: string,
    onEvent?: (event: { type: string; data: string }) => void
  ): Promise<string>;
}

export function createChatStreamHandler(orchestrator: StreamableOrchestrator) {
  return async (req: Request, res: Response) => {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required and must be a string' });
      return;
    }
    if (prompt.length > 5000) {
      res.status(400).json({ error: 'Prompt is too long (max 5000 characters)' });
      return;
    }
    const sessionId = (
      req.get('x-session-id') ||
      (typeof req.body.sessionId === 'string' ? req.body.sessionId : '') ||
      'default'
    ).slice(0, 128);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (event: { type: string; data: string }) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const answer = await orchestrator.processPrompt(prompt, sessionId, send);
      send({ type: 'answer', data: answer });
    } catch (error) {
      send({ type: 'error', data: 'LLM processing failed' });
    }
    res.write('data: [DONE]\n\n');
    res.end();
  };
}
