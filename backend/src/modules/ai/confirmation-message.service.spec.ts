import {afterEach, vi} from 'vitest';
import {
  ConfirmationMessageService,
  DEFAULT_GEMINI_MODEL,
  type GenAiClient,
  LLM_TIMEOUT_MS,
} from './confirmation-message.service.js';

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

  it('times out even if the client ignores the abort signal', async () => {
    vi.useFakeTimers();
    const client = fake(() => new Promise(() => {}));
    const pending = new ConfirmationMessageService(client).generate(input);
    await vi.advanceTimersByTimeAsync(LLM_TIMEOUT_MS + 1);
    expect(await pending).toBeNull();
    expect(client.models.generateContent.mock.calls[0][0].config?.abortSignal?.aborted).toBe(true);
  });

  it('asks for minimal thinking and a model default', async () => {
    const client = fake(async () => ({text: 'Hi Ana'}));
    await new ConfirmationMessageService(client).generate(input);
    const params = client.models.generateContent.mock.calls[0][0];
    expect(params.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(params.config?.thinkingConfig).toEqual({thinkingLevel: 'MINIMAL'});
  });

  it('retries once on 503 (high demand)', async () => {
    let n = 0;
    const client = fake(async () => {
      if (n++ === 0) throw Object.assign(new Error('high demand'), {status: 503});
      return {text: 'Hi Ana'};
    });
    expect(await new ConfirmationMessageService(client).generate(input)).toBe('Hi Ana');
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second 503', async () => {
    const client = fake(async () => {
      throw Object.assign(new Error('high demand'), {status: 503});
    });
    expect(await new ConfirmationMessageService(client).generate(input)).toBeNull();
    expect(client.models.generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries without thinking config when the model rejects it', async () => {
    const client = fake(async (params) => {
      if (params.config?.thinkingConfig) throw Object.assign(new Error('Thinking level MINIMAL is not supported'), {status: 400});
      return {text: 'Hi Ana'};
    });
    expect(await new ConfirmationMessageService(client).generate(input)).toBe('Hi Ana');
    expect(client.models.generateContent.mock.calls[1][0].config?.thinkingConfig).toBeUndefined();
  });

  it('isEnabled reflects whether a client exists', () => {
    expect(new ConfirmationMessageService().isEnabled()).toBe(false);
    expect(new ConfirmationMessageService(fake(async () => ({text: 'x'}))).isEnabled()).toBe(true);
  });
});
