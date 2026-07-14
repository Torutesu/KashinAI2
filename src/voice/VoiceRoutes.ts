// src/voice/VoiceRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { OrchestratorService } from '../llm/OrchestratorService';
import { createVoiceController } from './VoiceController';

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB safety cap
});

export function createVoiceRoutes(orchestratorService: OrchestratorService): Router {
  const router = Router();
  router.post('/query', upload.single('audio'), createVoiceController(orchestratorService));
  return router;
}