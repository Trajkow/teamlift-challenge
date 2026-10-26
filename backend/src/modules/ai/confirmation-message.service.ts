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
        thinkingConfig?: {thinkingLevel?: string};
        abortSignal?: AbortSignal;
      };
    }): Promise<{text?: string}>;
  };
};

export const GENAI_CLIENT = Symbol('GENAI_CLIENT');
// Fastest model that answered reliably on the free tier (measured 15 to 25 s per call; `gemini-flash-latest` timed out).
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
// The free tier is slow, so generation runs in the background after booking and the success screen polls for it.
export const LLM_TIMEOUT_MS = 40_000;
const MINIMAL_THINKING = {thinkingLevel: 'MINIMAL'};

@Injectable()
export class ConfirmationMessageService {
  private readonly logger = new Logger(ConfirmationMessageService.name);
  private cached: {key: string; client: GenAiClient} | null = null;

  constructor(@Optional() @Inject(GENAI_CLIENT) private readonly injected?: GenAiClient | null) {}

  private client(): GenAiClient | null {
    if (this.injected) return this.injected;
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) return null;
    if (this.cached?.key !== key) this.cached = {key, client: new GoogleGenAI({apiKey: key}) as unknown as GenAiClient};
    return this.cached.client;
  }

  /** True when a key is configured, so callers can skip starting a generation that can only fail. */
  isEnabled(): boolean {
    return this.client() !== null;
  }

  /** The generated message, or null on any failure (no key, error, timeout, empty output). Never throws. */
  async generate(input: ConfirmationInput): Promise<string | null> {
    const client = this.client();
    if (!client) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    // Race the abort signal so a client that ignores it still cannot hold the call past the timeout.
    const aborted = new Promise<never>((_, reject) =>
      controller.signal.addEventListener('abort', () => reject(new Error('timeout')), {once: true}),
    );
    aborted.catch(() => {});
    try {
      const res = await Promise.race([this.call(client, input, controller.signal), aborted]);
      const message = cleanOutput(res.text);
      if (!message) this.logger.warn('Gemini returned an empty confirmation message');
      return message;
    } catch (err) {
      // SDK messages carry the status and reason, never the key; the prompt and guest data are not logged.
      this.logger.warn(`Gemini call failed (${describe(err)})`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** One call, retried once on 503 (free-tier "high demand") and once without thinking config if the model rejects it. */
  private async call(client: GenAiClient, input: ConfirmationInput, signal: AbortSignal) {
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    let thinking: typeof MINIMAL_THINKING | undefined = MINIMAL_THINKING;
    let retriedBusy = false;
    for (;;) {
      try {
        return await client.models.generateContent({
          model,
          contents: buildPrompt(input),
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            maxOutputTokens: 300,
            temperature: 0.7,
            ...(thinking ? {thinkingConfig: thinking} : {}),
            abortSignal: signal,
          },
        });
      } catch (err) {
        if (signal.aborted) throw err;
        if (thinking && statusOf(err) === 400 && /thinking/i.test(messageOf(err))) {
          thinking = undefined;
        } else if (!retriedBusy && statusOf(err) === 503) {
          retriedBusy = true;
          await new Promise((r) => setTimeout(r, 1_000));
        } else {
          throw err;
        }
      }
    }
  }
}

const statusOf = (err: unknown) => (typeof (err as {status?: unknown})?.status === 'number' ? (err as {status: number}).status : null);
const messageOf = (err: unknown) => (err instanceof Error ? err.message : '');
const describe = (err: unknown) =>
  err instanceof Error ? `${err.name}${statusOf(err) ? ` ${statusOf(err)}` : ''}: ${err.message}`.slice(0, 200) : 'unknown error';
