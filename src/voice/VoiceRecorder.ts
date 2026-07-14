// src/voice/VoiceRecorder.ts
//
// Turns an arbitrary uploaded audio file (webm, mp3, m4a, ogg, wav, ...) into
// a 16kHz mono Float32 PCM buffer — the exact format @xenova/transformers'
// Whisper pipeline expects. Conversion is done with a locally bundled ffmpeg
// binary (ffmpeg-static); nothing is uploaded anywhere.

import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import * as wavefile from 'wavefile';

const WHISPER_SAMPLE_RATE = 16000;

function convertToWav16kMono(inputPath: string): Promise<string> {
  if (!ffmpegPath) {
    return Promise.reject(new Error('ffmpeg-static binary not found for this platform'));
  }
  const binPath: string = ffmpegPath;

  const outputPath = path.join(os.tmpdir(), `voice-${randomUUID()}.wav`);
  const args = [
    '-y',
    '-i', inputPath,
    '-ac', '1',
    '-ar', String(WHISPER_SAMPLE_RATE),
    '-f', 'wav',
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(binPath, args, (error: Error | null, _stdout: string, stderr: string) => {
      if (error) {
        reject(new Error(`ffmpeg conversion failed: ${stderr || error.message}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

function readWavAsFloat32(wavPath: string): Float32Array {
  const buffer = fs.readFileSync(wavPath);
  const wav = new wavefile.WaveFile(buffer);
  wav.toBitDepth('32f');

  // wavefile's .d.ts declares getSamples() -> Float64Array, but at runtime it
  // honors the OutputObject constructor we pass (Float32Array here).
  const raw = wav.getSamples(false, Float32Array) as unknown as Float32Array | Float32Array[];
  const samples = Array.isArray(raw) ? raw[0] : raw;
  return samples;
}

/**
 * Full pipeline: uploaded audio file path -> Float32Array PCM @ 16kHz mono.
 * The intermediate converted WAV file is cleaned up automatically.
 */
export async function preprocessAudio(inputPath: string): Promise<Float32Array> {
  const wavPath = await convertToWav16kMono(inputPath);
  try {
    return readWavAsFloat32(wavPath);
  } finally {
    fs.unlink(wavPath, () => {});
  }
}