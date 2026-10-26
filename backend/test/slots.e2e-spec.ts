import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {PrismaService} from '../src/prisma/prisma.service.js';
import {createTestApp, type TestApp} from './helpers/app.js';
import {uniqueFutureDate} from './helpers/slots.js';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

const createSlot = (body: object, headers: Record<string, string> = {}) =>
  t.http.post('/api/host/slots').set(headers).send(body);
const newSlot = async (extra: object = {}) => {
  const res = await createSlot({date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30, ...extra});
  expect(res.status).toBe(201);
  return res.body[0] as {id: string; startsAt: string; endsAt: string};
};
const book = (id: string, body: object = {name: 'Ana', email: 'Ana@Example.com'}) =>
  t.http.post(`/api/slots/${id}/bookings`).send(body);

describe('config and health', () => {
  it('returns config', async () => {
    const res = await t.http.get('/api/config');
    expect(res.body).toEqual({timeZone: 'Europe/Skopje', hostName: null, hostKeyRequired: false, calendarConnected: false});
  });
});

describe('creating slots', () => {
  it('creates one slot', async () => {
    const date = uniqueFutureDate();
    const res = await createSlot({date, startTime: '09:00', durationMinutes: 45});
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({durationMinutes: 45, isBooked: false, booking: null});
  });

  it('creates count=4 back-to-back slots', async () => {
    const res = await createSlot({date: uniqueFutureDate(), startTime: '09:00', durationMinutes: 30, count: 4});
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(res.body[i].startsAt).toBe(res.body[i - 1].endsAt);
  });

  it('rejects an overlapping slot with 409 SLOT_OVERLAP', async () => {
    const date = uniqueFutureDate();
    expect((await createSlot({date, startTime: '10:00', durationMinutes: 60})).status).toBe(201);
    const res = await createSlot({date, startTime: '10:30', durationMinutes: 60});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_OVERLAP');
    expect(res.body.message).toBe('This slot overlaps one you already published');
  });

  it('allows touching slots (end == next start)', async () => {
    const date = uniqueFutureDate();
    expect((await createSlot({date, startTime: '10:00', durationMinutes: 30})).status).toBe(201);
    expect((await createSlot({date, startTime: '10:30', durationMinutes: 30})).status).toBe(201);
  });

  it('rolls back the whole batch when one slot overlaps', async () => {
    const date = uniqueFutureDate();
    expect((await createSlot({date, startTime: '10:30', durationMinutes: 30})).status).toBe(201);
    const res = await createSlot({date, startTime: '09:30', durationMinutes: 30, count: 3});
    expect(res.status).toBe(409);
    const list = await t.http.get(`/api/slots?from=${date}&to=${date}`);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a slot in the past with 422', async () => {
    const res = await createSlot({date: '2020-01-01', startTime: '10:00', durationMinutes: 30});
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('SLOT_IN_PAST');
  });

  it('returns 400 with issues for a bad body', async () => {
    const res = await createSlot({date: 'nope', startTime: '25:00', durationMinutes: 1, count: 99});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
    expect(res.body.issues.length).toBeGreaterThanOrEqual(4);
  });
});

describe('booking', () => {
  it('books a slot and never leaks name or email publicly', async () => {
    const slot = await newSlot();
    const res = await book(slot.id, {name: 'Ana Test', email: 'Ana.Secret@Example.com', note: 'hello-note'});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({name: 'Ana Test', slot: {id: slot.id, isBooked: true}});

    const date = slot.startsAt.slice(0, 10);
    const list = await t.http.get(`/api/slots?from=${date}&to=${date}`);
    const publicSlot = list.body.find((s: {id: string}) => s.id === slot.id);
    expect(publicSlot.isBooked).toBe(true);
    const json = JSON.stringify(list.body);
    expect(json).not.toMatch(/Ana|secret|hello-note|email|note/i);

    const host = await t.http.get('/api/host/slots');
    const hostSlot = host.body.find((s: {id: string}) => s.id === slot.id);
    expect(hostSlot.booking).toMatchObject({name: 'Ana Test', email: 'ana.secret@example.com', note: 'hello-note'});
  });

  it('rejects a second booking with 409 SLOT_TAKEN', async () => {
    const slot = await newSlot();
    expect((await book(slot.id)).status).toBe(201);
    const res = await book(slot.id, {name: 'Bo', email: 'bo@example.com'});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_TAKEN');
  });

  it('returns 404 for an unknown or malformed slot id', async () => {
    expect((await book(randomUUID())).status).toBe(404);
    expect((await book('not-a-uuid')).status).toBe(404);
  });

  it('returns 422 when booking a slot that already started', async () => {
    const id = randomUUID();
    const start = new Date(Date.now() - 3600_000);
    await prisma.slot.create({data: {id, startsAt: start, endsAt: new Date(start.getTime() + 1800_000)}});
    const res = await book(id);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('SLOT_IN_PAST');
    await prisma.slot.delete({where: {id}});
  });

  it('returns 400 with issues for a bad booking body', async () => {
    const slot = await newSlot();
    const res = await book(slot.id, {name: '', email: 'x', note: 'n'.repeat(501)});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_FAILED');
    expect(res.body.issues).toHaveLength(3);
  });
});

describe('deleting and cancelling', () => {
  it('deletes an unbooked slot', async () => {
    const slot = await newSlot();
    expect((await t.http.delete(`/api/host/slots/${slot.id}`)).status).toBe(204);
    expect((await t.http.delete(`/api/host/slots/${slot.id}`)).status).toBe(404);
  });

  it('refuses to delete a booked slot with 409 SLOT_BOOKED', async () => {
    const slot = await newSlot();
    await book(slot.id);
    const res = await t.http.delete(`/api/host/slots/${slot.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('SLOT_BOOKED');
  });

  it('frees the slot when the booking is cancelled', async () => {
    const slot = await newSlot();
    const booked = await book(slot.id);
    expect((await t.http.delete(`/api/host/bookings/${booked.body.id}`)).status).toBe(204);
    expect((await t.http.delete(`/api/host/bookings/${booked.body.id}`)).status).toBe(404);
    expect((await book(slot.id, {name: 'Cy', email: 'cy@example.com'})).status).toBe(201);
  });

  it('returns 404 for unknown ids', async () => {
    expect((await t.http.delete(`/api/host/slots/${randomUUID()}`)).status).toBe(404);
    expect((await t.http.delete(`/api/host/bookings/${randomUUID()}`)).status).toBe(404);
  });
});

describe('listing', () => {
  it('validates the date range and filters by it', async () => {
    expect((await t.http.get('/api/slots?from=bad')).status).toBe(400);
    const slot = await newSlot();
    const day = slot.startsAt.slice(0, 10);
    const inRange = await t.http.get(`/api/slots?from=${day}&to=${day}`);
    expect(inRange.body.map((s: {id: string}) => s.id)).toContain(slot.id);
    const sorted = [...inRange.body].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    expect(inRange.body).toEqual(sorted);
    const outside = await t.http.get('/api/slots?from=2020-01-01&to=2020-01-02');
    expect(outside.body).toEqual([]);
  });

  it('hides past slots from the public list and from the host list unless asked', async () => {
    const id = randomUUID();
    const start = new Date(Date.now() - 3 * 3600_000);
    await prisma.slot.create({data: {id, startsAt: start, endsAt: new Date(start.getTime() + 1800_000)}});
    const pub = await t.http.get('/api/slots?from=2000-01-01&to=2100-01-01');
    expect(pub.body.map((s: {id: string}) => s.id)).not.toContain(id);
    const hostDefault = await t.http.get('/api/host/slots');
    expect(hostDefault.body.map((s: {id: string}) => s.id)).not.toContain(id);
    const hostPast = await t.http.get('/api/host/slots?includePast=true');
    expect(hostPast.body.map((s: {id: string}) => s.id)).toContain(id);
    await prisma.slot.delete({where: {id}});
  });
});

describe('host key', () => {
  it('is open when HOST_KEY is unset', async () => {
    expect((await t.http.get('/api/host/slots')).status).toBe(200);
  });

  it('requires a matching X-Host-Key when HOST_KEY is set', async () => {
    process.env.HOST_KEY = 'secret-key';
    try {
      expect((await t.http.get('/api/config')).body.hostKeyRequired).toBe(true);
      const missing = await t.http.get('/api/host/slots');
      expect(missing.status).toBe(401);
      expect(missing.body.error).toBe('HOST_KEY_REQUIRED');
      expect((await t.http.get('/api/host/slots').set('X-Host-Key', 'wrong-key!')).status).toBe(401);
      expect((await t.http.get('/api/host/slots').set('X-Host-Key', 'x')).status).toBe(401);
      expect((await t.http.get('/api/host/slots').set('X-Host-Key', 'secret-key')).status).toBe(200);
      const slot = await createSlot(
        {date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30},
        {'X-Host-Key': 'secret-key'},
      );
      expect(slot.status).toBe(201);
      expect((await createSlot({date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30})).status).toBe(401);
      // public routes stay open
      expect((await t.http.get('/api/slots')).status).toBe(200);
    } finally {
      delete process.env.HOST_KEY;
    }
  });
});

describe('rate limits', () => {
  it('limits bookings per IP when enabled', async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_BOOKING_PER_MIN = '3';
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await book(randomUUID())).status);
      expect(statuses).toEqual([404, 404, 404, 429, 429]);
    } finally {
      process.env.RATE_LIMIT_ENABLED = 'false';
      delete process.env.RATE_LIMIT_BOOKING_PER_MIN;
    }
  });
});

describe('confirmation message', () => {
  const confirm = (id: string) => t.http.post(`/api/bookings/${id}/confirmation-message`);

  it('falls back to the template (200) when no Gemini key is set', async () => {
    const slot = await newSlot();
    const booking = (await book(slot.id, {name: 'Ana', email: 'ana@example.com'})).body;
    const res = await confirm(booking.id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.source).toBe('template');
    expect(res.body.message).toContain('Ana');
  });

  it('returns a stored AI message with source ai', async () => {
    const slot = await newSlot();
    const booking = (await book(slot.id)).body;
    await prisma.booking.update({where: {id: booking.id}, data: {confirmationMessage: 'See you soon, Ana!'}});
    const res = await confirm(booking.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({status: 'ready', message: 'See you soon, Ana!', source: 'ai'});
  });

  it('404s for unknown or malformed booking ids', async () => {
    expect((await confirm(randomUUID())).status).toBe(404);
    expect((await confirm('nope')).status).toBe(404);
  });
});
