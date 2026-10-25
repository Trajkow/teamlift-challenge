import {afterEach, vi} from 'vitest';
import {ConfirmationMessageService, type GenAiClient, LLM_TIMEOUT_MS} from './confirmation-message.service.js';

const input = {
  name: 'Ana',
  startsAt: new Date('2030-03-05T09:30:00Z'),
  durationMinutes: 30,
  note: null,
  timeZone: 'Europe/Skopje',
  hostName: 'Marko',
};
const fake = (impl: GenAiClient['models']['generateContent']) => ({models: {generateContent: vi.fn(impl)}});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe('ConfirmationMessageService', () => {
  it('returns the cleaned model text and sends model, prompt and system instruction', async () => {
    process.env.GEMINI_MODEL = 'test-model';
    const client = fake(async () => ({text: '**See you Tuesday, Ana!**'}));
    const msg = await new ConfirmationMessageService(client).generate(input);
    expect(msg).toBe('See you Tuesday, Ana!');
    const params = client.models.generateContent.mock.calls[0][0];
    expect(params.model).toBe('test-model');
    expect(params.contents).toContain('<guest_data>');
    expect(params.config?.systemInstruction).toContain('untrusted');
  });

  it('returns null without a key (no client)', async () => {
    expect(await new ConfirmationMessageService().generate(input)).toBeNull();
  });

  it('returns null when the client throws', async () => {
    const client = fake(async () => {
      throw new Error('quota');
    });
    expect(await new ConfirmationMessageService(client).generate(input)).toBeNull();
  });

  it('returns null on empty output', async () => {
    expect(await new ConfirmationMessageService(fake(async () => ({text: ' '}))).generate(input)).toBeNull();
  });

  it('times out after 5 seconds even if the client ignores the abort signal', async () => {
    vi.useFakeTimers();
    const client = fake(() => new Promise(() => {}));
    const pending = new ConfirmationMessageService(client).generate(input);
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS + 1);
    expect(await pending).toBeNull();
    expect(client.models.generateContent.mock.calls[0][0].config?.abortSignal?.aborted).toBe(true);
  });
});
