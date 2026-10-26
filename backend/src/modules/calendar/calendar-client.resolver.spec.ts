import {randomBytes} from 'node:crypto';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CalendarClientResolver} from './calendar-client.resolver.js';
import type {CalendarClient} from './calendar.types.js';
import {InvalidGrantError, type OAuthProvider} from './oauth.provider.js';
import {OAuthCalendarClient} from './oauth-calendar.client.js';
import {encrypt} from './token-crypto.js';

const key = randomBytes(32);
const serviceAccount: CalendarClient = {freeBusy: async () => []};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'host',
  email: 'host@example.com',
  refreshTokenEncrypted: encrypt('refresh', key),
  needsReconnect: false,
  connectedAt: new Date('2030-01-01T00:00:00Z'),
  ...over,
});
const fakePrisma = (found: unknown) => ({
  calendarConnection: {findUnique: vi.fn(async () => found), updateMany: vi.fn(async () => ({count: 1}))},
});
const provider = (accessToken: OAuthProvider['accessToken']): OAuthProvider => ({
  available: () => true,
  authUrl: () => 'https://accounts.example/auth',
  exchangeCode: async () => ({refreshToken: 'r', email: 'a@b.c'}),
  accessToken,
  revoke: async () => undefined,
});
const make = (found: unknown, sa: CalendarClient | null = serviceAccount, p = provider(async () => ({token: 't', expiresAt: Date.now() + 3_600_000}))) => {
  const prisma = fakePrisma(found);
  // The resolver only touches `calendarConnection`, so the partial fake is enough.
  const resolver = new CalendarClientResolver(prisma as never, p, sa);
  return {resolver, prisma};
};

beforeEach(() => {
  process.env.CALENDAR_TOKEN_KEY = key.toString('base64');
});
afterEach(() => {
  delete process.env.CALENDAR_TOKEN_KEY;
});

describe('CalendarClientResolver priority', () => {
  it('prefers the OAuth connection over the service account', async () => {
    const {resolver} = make(row());
    const r = await resolver.resolve();
    expect(r.source).toBe('oauth');
    expect(r.client).toBeInstanceOf(OAuthCalendarClient);
  });

  it('falls back to the service account without a connection', async () => {
    const r = await make(null).resolver.resolve();
    expect(r).toEqual({client: serviceAccount, source: 'service_account'});
  });

  it('is off with neither', async () => {
    expect(await make(null, null).resolver.resolve()).toEqual({client: null, source: null});
  });

  it('fails open (no client, no fallback) when the connection needs reconnecting', async () => {
    const r = await make(row({needsReconnect: true})).resolver.resolve();
    expect(r).toEqual({client: null, source: 'oauth'});
  });

  it('marks the connection when the token cannot be decrypted', async () => {
    const {resolver, prisma} = make(row({refreshTokenEncrypted: encrypt('x', randomBytes(32))}));
    expect((await resolver.resolve()).client).toBeNull();
    expect(prisma.calendarConnection.updateMany).toHaveBeenCalled();
  });

  it('falls back when the lookup itself fails', async () => {
    const {resolver, prisma} = make(null);
    prisma.calendarConnection.findUnique.mockRejectedValueOnce(new Error('db down'));
    expect((await resolver.resolve()).source).toBe('service_account');
  });

  it('reuses the OAuth client while the row is unchanged', async () => {
    const {resolver} = make(row());
    expect((await resolver.resolve()).client).toBe((await resolver.resolve()).client);
  });
});

describe('needsReconnect on invalid_grant', () => {
  it('marks the connection and rejects (so the request fails open)', async () => {
    const {resolver, prisma} = make(
      row(),
      null,
      provider(async () => {
        throw new InvalidGrantError();
      }),
    );
    const {client} = await resolver.resolve();
    await expect(client!.freeBusy(new Date(), new Date(), new AbortController().signal)).rejects.toBeInstanceOf(InvalidGrantError);
    expect(prisma.calendarConnection.updateMany).toHaveBeenCalledWith({where: {id: 'host'}, data: {needsReconnect: true}});
  });

  it('does not mark the connection for other failures', async () => {
    const onInvalid = vi.fn();
    const client = new OAuthCalendarClient(
      provider(async () => {
        throw new Error('network');
      }),
      'r',
      onInvalid,
    );
    await expect(client.freeBusy(new Date(), new Date(), new AbortController().signal)).rejects.toThrow('network');
    expect(onInvalid).not.toHaveBeenCalled();
  });
});
