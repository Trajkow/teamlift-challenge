import {randomBytes} from 'node:crypto';
import {Test} from '@nestjs/testing';
import supertest from 'supertest';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {AppModule} from '../src/app.module.js';
import {configureApp} from '../src/configure-app.js';
import {CALENDAR_CLIENT, type CalendarClient, type Interval} from '../src/modules/calendar/calendar.types.js';
import {InvalidGrantError, OAUTH_PROVIDER, type OAuthProvider} from '../src/modules/calendar/oauth.provider.js';
import {decrypt} from '../src/modules/calendar/token-crypto.js';
import {PrismaService} from '../src/prisma/prisma.service.js';
import {createTestApp, type TestApp} from './helpers/app.js';
import {uniqueFutureDate} from './helpers/slots.js';

const REFRESH_TOKEN = 'fake-refresh-token-1234567890';
const KEY = randomBytes(32).toString('base64');

/** Fake Google OAuth: nothing here (or anywhere in this file) reaches the network. */
const oauth = {revoked: [] as string[], invalidGrant: false, accessTokens: 0, noRefreshToken: false};
const fakeProvider: OAuthProvider = {
  available: () => true,
  authUrl: (state) => `https://accounts.fake.test/auth?state=${state}`,
  async exchangeCode(code) {
    if (code !== 'good-code') throw new Error('bad code');
    return {refreshToken: oauth.noRefreshToken ? null : REFRESH_TOKEN, email: 'host@example.com'};
  },
  async accessToken(refreshToken) {
    oauth.accessTokens += 1;
    if (oauth.invalidGrant) throw new InvalidGrantError();
    expect(refreshToken).toBe(REFRESH_TOKEN);
    return {token: 'fake-access-token', expiresAt: Date.now() + 3_600_000};
  },
  async revoke(refreshToken) {
    oauth.revoked.push(refreshToken);
  },
};

/** The OAuth path calls freeBusy over fetch; answer it locally and refuse anything else. */
const calendar = {busy: [] as Interval[]};
const serviceAccount = {busy: [] as Interval[]};
const fakeServiceAccount: CalendarClient = {async freeBusy() { return serviceAccount.busy; }};
const realFetch = globalThis.fetch;

let t: TestApp;
let plain: TestApp;
let prisma: PrismaService;

const stateOf = (location: string) => new URL(location).searchParams.get('state') ?? '';
const connect = async (code = 'good-code') => {
  const start = await t.http.get('/api/host/calendar/connect');
  return t.http.get('/api/host/calendar/callback').query({code, state: stateOf(start.headers.location!)});
};
const rawRow = async () =>
  (await prisma.$queryRaw<{refresh_token_encrypted: string; email: string}[]>`SELECT * FROM calendar_connection`)[0];

beforeAll(async () => {
  process.env.CALENDAR_TOKEN_KEY = KEY;
  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(OAUTH_PROVIDER)
    .useValue(fakeProvider)
    .overrideProvider(CALENDAR_CLIENT)
    .useValue(fakeServiceAccount)
    .compile();
  const app = moduleRef.createNestApplication({bodyParser: false});
  configureApp(app);
  await app.listen(0);
  t = {app, server: app.getHttpServer(), http: supertest(app.getHttpServer())};
  prisma = app.get(PrismaService);
  plain = await createTestApp();
});
afterAll(async () => {
  await prisma.calendarConnection.deleteMany();
  await t.app.close();
  await plain.app.close();
  delete process.env.CALENDAR_TOKEN_KEY;
});
beforeEach(async () => {
  await prisma.calendarConnection.deleteMany();
  Object.assign(oauth, {revoked: [], invalidGrant: false, accessTokens: 0, noRefreshToken: false});
  calendar.busy = [];
  serviceAccount.busy = [];
  vi.stubGlobal('fetch', async (input: unknown, init?: {body?: string}) => {
    if (!String(input).startsWith('https://www.googleapis.com/calendar/v3/freeBusy')) {
      throw new Error(`unexpected network call: ${String(input)}`);
    }
    expect(JSON.parse(init?.body ?? '{}').items).toEqual([{id: 'primary'}]);
    const busy = calendar.busy.map((b) => ({start: b.start.toISOString(), end: b.end.toISOString()}));
    return new Response(JSON.stringify({calendars: {primary: {busy}}}), {status: 200});
  });
});
afterEach(() => {
  vi.stubGlobal('fetch', realFetch);
});

const newSlot = async () => {
  const res = await t.http
    .post('/api/host/slots')
    .send({date: uniqueFutureDate(), startTime: '10:00', durationMinutes: 30});
  expect(res.status).toBe(201);
  return res.body[0] as {id: string; startsAt: string; endsAt: string};
};
const isBusy = async (s: {id: string; startsAt: string}) => {
  const day = s.startsAt.slice(0, 10);
  const res = await t.http.get(`/api/slots?from=${day}&to=${day}`);
  return (res.body as {id: string; isBusy: boolean}[]).find((x) => x.id === s.id)?.isBusy;
};
const clash = (s: {startsAt: string; endsAt: string}): Interval[] => [
  {start: new Date(new Date(s.startsAt).getTime() + 5 * 60_000), end: new Date(s.endsAt)},
];

describe('google calendar oauth', () => {
  it('starts off: not connected, oauth available', async () => {
    const res = await t.http.get('/api/host/calendar');
    expect(res.body).toEqual({connected: true, source: 'service_account', email: null, needsReconnect: false, oauthAvailable: true});
  });

  it('connect redirects to Google with a state', async () => {
    const res = await t.http.get('/api/host/calendar/connect');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.fake\.test\/auth\?state=.{20,}/);
  });

  it('the callback stores an encrypted token and never the plaintext', async () => {
    const res = await connect();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/host?calendar=connected');
    const row = await rawRow();
    expect(row?.email).toBe('host@example.com');
    expect(row?.refresh_token_encrypted).not.toContain(REFRESH_TOKEN);
    expect(Buffer.from(row!.refresh_token_encrypted).toString()).not.toContain(REFRESH_TOKEN);
    expect(decrypt(row!.refresh_token_encrypted, Buffer.from(KEY, 'base64'))).toBe(REFRESH_TOKEN);
  });

  it('status shows the email and never a token', async () => {
    await connect();
    const res = await t.http.get('/api/host/calendar');
    expect(res.body).toEqual({connected: true, source: 'oauth', email: 'host@example.com', needsReconnect: false, oauthAvailable: true});
    expect(JSON.stringify(res.body)).not.toContain(REFRESH_TOKEN);
    expect((await t.http.get('/api/config')).body.calendarConnected).toBe(true);
  });

  it('marks a clashing slot busy through the connected calendar and wins over the service account', async () => {
    const slot = await newSlot();
    await connect();
    serviceAccount.busy = [];
    calendar.busy = clash(slot);
    expect(await isBusy(slot)).toBe(true);
    const book = await t.http.post(`/api/slots/${slot.id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
    expect(book.status).toBe(409);
    expect(book.body.error).toBe('SLOT_UNAVAILABLE');
  });

  it('disconnect revokes, deletes the row and falls back to the service account', async () => {
    const slot = await newSlot();
    await connect();
    calendar.busy = clash(slot);
    expect(await isBusy(slot)).toBe(true); // caches the OAuth answer
    expect((await t.http.delete('/api/host/calendar')).status).toBe(204);
    expect(oauth.revoked).toEqual([REFRESH_TOKEN]);
    expect(await rawRow()).toBeUndefined();
    expect(await isBusy(slot)).toBe(false); // cache was cleared; the service account has no events
    expect((await t.http.delete('/api/host/calendar')).status).toBe(204); // already gone: still 204
    serviceAccount.busy = clash(slot);
    // The booking check bypasses the cache and now asks the service account.
    const book = await t.http.post(`/api/slots/${slot.id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
    expect(book.status).toBe(409);
    expect((await t.http.get('/api/host/calendar')).body.source).toBe('service_account');
  });

  it('a bad, reused or missing state redirects with calendar=error', async () => {
    const bad = await t.http.get('/api/host/calendar/callback').query({code: 'good-code', state: 'unknown'});
    expect(bad.status).toBe(302);
    expect(bad.headers.location).toBe('/host?calendar=error');
    const start = await t.http.get('/api/host/calendar/connect');
    const state = stateOf(start.headers.location!);
    expect((await t.http.get('/api/host/calendar/callback').query({code: 'good-code', state})).headers.location).toBe('/host?calendar=connected');
    const reuse = await t.http.get('/api/host/calendar/callback').query({code: 'good-code', state});
    expect(reuse.headers.location).toBe('/host?calendar=error');
    expect((await t.http.get('/api/host/calendar/callback')).headers.location).toBe('/host?calendar=error');
    expect((await t.http.get('/api/host/calendar/callback?state=a&state=b&code=x')).headers.location).toBe('/host?calendar=error');
  });

  it('a Google error, a failed exchange or a missing refresh token redirects with calendar=error and stores nothing', async () => {
    const start = await t.http.get('/api/host/calendar/connect');
    const denied = await t.http
      .get('/api/host/calendar/callback')
      .query({error: 'access_denied <script>', state: stateOf(start.headers.location!)});
    expect(denied.headers.location).toBe('/host?calendar=error');
    expect((await connect('wrong-code')).headers.location).toBe('/host?calendar=error');
    oauth.noRefreshToken = true;
    expect((await connect()).headers.location).toBe('/host?calendar=error');
    expect(await rawRow()).toBeUndefined();
  });

  it('connecting again replaces the row', async () => {
    await connect();
    await connect();
    expect(await prisma.calendarConnection.count()).toBe(1);
  });

  it('fails open and asks to reconnect when Google rejects the token', async () => {
    const slot = await newSlot();
    await connect();
    oauth.invalidGrant = true;
    calendar.busy = clash(slot);
    expect(await isBusy(slot)).toBe(false);
    const book = await t.http.post(`/api/slots/${slot.id}/bookings`).send({name: 'Ana', email: 'ana@example.com'});
    expect(book.status).toBe(201);
    const status = (await t.http.get('/api/host/calendar')).body;
    expect(status).toMatchObject({connected: true, source: 'oauth', needsReconnect: true});
    // Reconnecting clears the flag.
    oauth.invalidGrant = false;
    await connect();
    expect((await t.http.get('/api/host/calendar')).body.needsReconnect).toBe(false);
  });

  it('with a host key, connect needs ?hostKey= and the other routes need the header', async () => {
    process.env.HOST_KEY = 'sesame';
    try {
      expect((await t.http.get('/api/host/calendar/connect')).status).toBe(401);
      expect((await t.http.get('/api/host/calendar/connect').query({hostKey: 'wrong'})).status).toBe(401);
      expect((await t.http.get('/api/host/calendar/connect').query({hostKey: 'sesame'})).status).toBe(302);
      expect((await t.http.get('/api/host/calendar')).status).toBe(401);
      expect((await t.http.get('/api/host/calendar').set('X-Host-Key', 'sesame')).status).toBe(200);
      expect((await t.http.delete('/api/host/calendar')).status).toBe(401);
      // The callback is protected by state, not the key.
      expect((await t.http.get('/api/host/calendar/callback')).status).toBe(302);
    } finally {
      delete process.env.HOST_KEY;
    }
  });
});

describe('without oauth env', () => {
  it('reports oauthAvailable: false and connect redirects with an error', async () => {
    const res = await plain.http.get('/api/host/calendar');
    expect(res.body).toEqual({connected: false, source: null, email: null, needsReconnect: false, oauthAvailable: false});
    const connectRes = await plain.http.get('/api/host/calendar/connect');
    expect(connectRes.status).toBe(302);
    expect(connectRes.headers.location).toBe('/host?calendar=error');
  });
});
