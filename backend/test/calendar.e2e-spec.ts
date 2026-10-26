import {Test} from '@nestjs/testing';
import supertest from 'supertest';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {configureApp} from '../src/configure-app.js';
import {CALENDAR_CLIENT, type CalendarClient, type Interval} from '../src/modules/calendar/calendar.types.js';
import {createTestApp, type TestApp} from './helpers/app.js';
import {uniqueFutureDate} from './helpers/slots.js';

/** Fake Google client: tests set `busy` or `fail`. */
const state: {busy: Interval[]; fail: boolean; calls: number} = {busy: [], fail: false, calls: 0};
const fakeClient: CalendarClient = {
  async freeBusy() {
    state.calls += 1;
    if (state.fail) throw new Error('boom');
    return state.busy;
  },
};

let t: TestApp;
let plain: TestApp;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(CALENDAR_CLIENT)
    .useValue(fakeClient)
    .compile();
  const app = moduleRef.createNestApplication({bodyParser: false});
  configureApp(app);
  await app.listen(0);
  t = {app, server: app.getHttpServer(), http: supertest(app.getHttpServer())};
  plain = await createTestApp();
});
afterAll(async () => {
  await t.app.close();
  await plain.app.close();
});

const newSlot = async () => {
  const res = await t.http
    .post('/api/host/slots')
    .send({date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30});
  expect(res.status).toBe(201);
  return res.body[0] as {id: string; startsAt: string; endsAt: string};
};
const book = (id: string) => t.http.post(`/api/slots/${id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
const publicSlot = async (id: string, startsAt: string) => {
  const day = startsAt.slice(0, 10);
  const res = await t.http.get(`/api/slots?from=${day}&to=${day}`);
  return (res.body as {id: string; isBusy: boolean}[]).find((s) => s.id === id);
};
const clash = (s: {startsAt: string; endsAt: string}): Interval[] => [
  {start: new Date(new Date(s.startsAt).getTime() + 5 * 60_000), end: new Date(s.endsAt)},
];

describe('calendar conflicts', () => {
  it('config reports calendarConnected', async () => {
    expect((await t.http.get('/api/config')).body.calendarConnected).toBe(true);
    expect((await plain.http.get('/api/config')).body.calendarConnected).toBe(false);
  });

  it('marks a clashing slot busy, shows it to the host, and refuses to book it', async () => {
    const slot = await newSlot();
    state.fail = false;
    state.busy = clash(slot);
    expect((await publicSlot(slot.id, slot.startsAt))?.isBusy).toBe(true);
    const host = (await t.http.get('/api/host/slots')).body as {id: string; isBusy: boolean}[];
    expect(host.find((s) => s.id === slot.id)?.isBusy).toBe(true);
    const res = await book(slot.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_UNAVAILABLE');
    state.busy = [];
  });

  it('a back-to-back event is not a clash', async () => {
    const slot = await newSlot();
    state.busy = [{start: new Date(slot.endsAt), end: new Date(new Date(slot.endsAt).getTime() + 3_600_000)}];
    expect((await publicSlot(slot.id, slot.startsAt))?.isBusy).toBe(false);
    state.busy = [];
  });

  it('fails open: listing and booking work when the client fails', async () => {
    const slot = await newSlot();
    state.fail = true;
    state.busy = clash(slot);
    expect((await publicSlot(slot.id, slot.startsAt))?.isBusy).toBe(false);
    expect((await book(slot.id)).status).toBe(201);
    state.fail = false;
    state.busy = [];
  });

  it('a booked slot is never marked busy, and booking re-checks bypass the cache', async () => {
    const slot = await newSlot();
    state.busy = [];
    expect((await publicSlot(slot.id, slot.startsAt))?.isBusy).toBe(false); // caches "free"
    state.busy = clash(slot);
    expect((await book(slot.id)).status).toBe(409); // fresh check sees the new event
    state.busy = [];
    expect((await book(slot.id)).status).toBe(201);
    state.busy = clash(slot);
    const after = await t.http.get(`/api/slots?from=${slot.startsAt.slice(0, 10)}&to=${slot.startsAt.slice(0, 10)}`);
    const found = (after.body as {id: string; isBooked: boolean; isBusy: boolean}[]).find((s) => s.id === slot.id);
    expect(found).toMatchObject({isBooked: true, isBusy: false});
    state.busy = [];
  });
});

describe('without calendar env', () => {
  it('slots are never busy and booking works', async () => {
    const created = await plain.http
      .post('/api/host/slots')
      .send({date: uniqueFutureDate(), startTime: '11:00', durationMinutes: 30});
    const slot = created.body[0] as {id: string};
    const res = await plain.http.post(`/api/slots/${slot.id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
    expect(res.status).toBe(201);
    expect(res.body.slot.isBusy).toBe(false);
  });
});
