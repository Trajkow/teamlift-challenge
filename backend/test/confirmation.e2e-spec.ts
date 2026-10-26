import {Test} from '@nestjs/testing';
import supertest from 'supertest';
import {afterAll, beforeAll, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {configureApp} from '../src/configure-app.js';
import {GENAI_CLIENT, type GenAiClient} from '../src/modules/ai/confirmation-message.service.js';
import {PrismaService} from '../src/prisma/prisma.service.js';
import type {TestApp} from './helpers/app.js';
import {uniqueFutureDate} from './helpers/slots.js';

/** Fake Gemini client: each call waits until the test releases it, then answers or fails. */
const gate: {release: () => void; fail: boolean; calls: number} = {release: () => {}, fail: false, calls: 0};
const fakeClient: GenAiClient = {
  models: {
    generateContent: () =>
      new Promise((resolve, reject) => {
        gate.calls += 1;
        gate.release = () => (gate.fail ? reject(new Error('boom')) : resolve({text: 'See you Tuesday, Ana!'}));
      }),
  },
};

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(GENAI_CLIENT)
    .useValue(fakeClient)
    .compile();
  const app = moduleRef.createNestApplication({bodyParser: false});
  configureApp(app);
  await app.listen(0);
  t = {app, server: app.getHttpServer(), http: supertest(app.getHttpServer())};
  prisma = app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

const bookNewSlot = async () => {
  const slot = (
    await t.http.post('/api/host/slots').send({date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30})
  ).body[0];
  const res = await t.http.post(`/api/slots/${slot.id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
  expect(res.status).toBe(201);
  return res.body.id as string;
};
const confirm = (id: string) => t.http.post(`/api/bookings/${id}/confirmation-message`);
/** Waits until the fake has been called `n` times (generation starts with a DB read, so not synchronously). */
const waitForCalls = async (n: number) => {
  for (let i = 0; i < 100 && gate.calls < n; i++) await new Promise((r) => setTimeout(r, 10));
  expect(gate.calls).toBe(n);
};
/** Polls until the result is no longer pending, like the success screen does. */
const settle = async (id: string) => {
  for (let i = 0; i < 50; i++) {
    const res = await confirm(id);
    if (res.body.status !== 'pending') return res.body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('still pending');
};

it('starts generating on booking, answers pending, then returns and stores the AI text', async () => {
  gate.fail = false;
  const calls = gate.calls;
  const id = await bookNewSlot();
  await waitForCalls(calls + 1); // started by the booking itself
  expect((await confirm(id)).body).toEqual({status: 'pending'});
  expect(gate.calls).toBe(calls + 1); // polling does not start a second call
  gate.release();
  expect(await settle(id)).toEqual({status: 'ready', message: 'See you Tuesday, Ana!', source: 'ai'});
  const row = await prisma.booking.findUnique({where: {id}, select: {confirmationMessage: true}});
  expect(row?.confirmationMessage).toBe('See you Tuesday, Ana!');
});

it('falls back to the template when generation fails, without retrying on every poll', async () => {
  gate.fail = true;
  const calls = gate.calls;
  const id = await bookNewSlot();
  await waitForCalls(calls + 1);
  gate.release();
  const result = await settle(id);
  expect(result.status).toBe('ready');
  expect(result.source).toBe('template');
  expect(result.message).toContain('Ana');
  await confirm(id);
  expect(gate.calls).toBe(calls + 1);
});
