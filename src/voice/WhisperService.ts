// src/voice/WhisperService.ts
//
// Loads a local Whisper model once via @xenova/transformers (runs on ONNX
// Runtime, fully offline — no OpenAI API, no cloud call) and reuses it for
// every transcription request. Model choice/language are configurable via env
// vars so you can trade off speed vs. accuracy without touching code.

// NOTE: @xenova/transformers (and its native `sharp` dependency) is imported
// lazily inside load(), NOT at module top-level. Voice is optional, so a missing
// or unbuilt native binary must not prevent the whole server from starting — the
// failure surfaces only when /voice is actually used (or preload() rejects, which
// the server startup catches and warns about).

type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<any>;

const MODEL_ID = process.env.WHISPER_MODEL || 'Xenova/whisper-base';
// Leave WHISPER_LANGUAGE unset to let Whisper auto-detect the spoken language.
const LANGUAGE = process.env.WHISPER_LANGUAGE;

export class WhisperService {
  private static loadingPromise: Promise<Transcriber> | null = null;

  private static load(): Promise<Transcriber> {
    if (!this.loadingPromise) {
      console.log(`[WhisperService] Loading local Whisper model "${MODEL_ID}" (one-time)...`);
      this.loadingPromise = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return (await pipeline('automatic-speech-recognition', MODEL_ID)) as unknown as Transcriber;
      })();
      this.loadingPromise.then(
        () => console.log('[WhisperService] Model loaded and ready.'),
        (err) => console.error('[WhisperService] Failed to load model:', err)
      );
    }
    return this.loadingPromise;
  }

  /** Call at server startup to warm the model up before the first real request. */
  static preload(): Promise<Transcriber> {
    return this.load();
  }

  static async transcribe(audio: Float32Array): Promise<string> {
    const transcriber = await this.load();
    const result = await transcriber(audio, {
      language: LANGUAGE,
      task: 'transcribe',
      chunk_length_s: 30,
    });

    if (Array.isArray(result)) {
      return result.map((r: any) => r.text).join(' ').trim();
    }
    return (result?.text || '').trim();
  }
}