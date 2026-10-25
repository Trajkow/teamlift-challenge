import {Inject, Injectable, Logger, Optional} from '@nestjs/common';
import {GoogleGenAI} from '@google/genai';
import {buildPrompt, cleanOutput, type ConfirmationInput, SYSTEM_INSTRUCTION} from './prompt.js';

/** The slice of the Gen AI client that we use; tests provide a fake. */
export type GenAiClient = {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        maxOutputTokens?: number;
        temperature?: number;
        abortSignal?: AbortSignal;
      };
    }): Promise<{text?: string}>;
  };
};

export const GENAI_CLIENT = Symbol('GENAI_CLIENT');
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const LLM_TIMEOUT_MS = 5_000;

@Injectable()
export class ConfirmationMessageService {
  private readonly logger = new Logger(ConfirmationMessageService.name);
  private cached: {key: string; client: GenAiClient} | null = null;

  constructor(@Optional() @Inject(GENAI_CLIENT) private readonly injected?: GenAiClient) {}

  private client(): GenAiClient | null {
    if (this.injected) return this.injected;
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    if (this.cached?.key !== key) this.cached = {key, client: new GoogleGenAI({apiKey: key}) as unknown as GenAiClient};
    return this.cached.client;
  }

  /** The generated message, or null on any failure (no key, error, timeout, empty output). Never throws. */
  async generate(input: ConfirmationInput): Promise<string | null> {
    const client = this.client();
    if (!client) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const call = client.models.generateContent({
        model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
        contents: buildPrompt(input),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 200,
          temperature: 0.7,
          abortSignal: controller.signal,
        },
      });
      // Race the abort signal so a client that ignores it still cannot hold the request past the timeout.
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('timeout')), {once: true}),
      );
      const res = await Promise.race([call, aborted]);
      const message = cleanOutput(res.text);
      if (!message) this.logger.warn('Gemini returned an empty confirmation message');
      return message;
    } catch (err) {
      // Log only the error class/message of the SDK, never the prompt or guest data.
      this.logger.warn(`Gemini call failed: ${err instanceof Error ? err.name : 'unknown error'}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
