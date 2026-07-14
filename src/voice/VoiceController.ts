// src/voice/VoiceController.ts
//
// Glue between an uploaded audio file and the existing chat pipeline.
// Reuses OrchestratorService.processPrompt exactly like /chat does — no LLM
// logic is duplicated here.

import { Request, Response } from 'express';
import fs from 'fs';
import { OrchestratorService } from '../llm/OrchestratorService';
import { preprocessAudio } from './VoiceRecorder';
import { WhisperService } from './WhisperService';

export function createVoiceController(orchestratorService: OrchestratorService) {
  return async function handleVoiceQuery(req: Request, res: Response) {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Audio file is required (multipart field name: "audio")' });
      return;
    }

    try {
      // 1. Decode uploaded audio -> 16kHz mono PCM (local ffmpeg, no upload anywhere)
      const audioSamples = await preprocessAudio(file.path);

      // 2. Local Whisper transcription (no cloud speech API)
      const transcript = await WhisperService.transcribe(audioSamples);

      if (!transcript) {
        res.status(422).json({ error: 'Could not transcribe any speech from the audio' });
        return;
      }

      // 3. Reuse the exact same RAG + Gemini + tool-calling flow as /chat
      const response = await orchestratorService.processPrompt(transcript);

      res.json({ transcript, response });
    } catch (error) {
      console.error('[VoiceController] /voice/query error:', error);
      res.status(500).json({ error: 'Voice processing failed' });
    } finally {
      fs.unlink(file.path, () => {});
    }
  };
}