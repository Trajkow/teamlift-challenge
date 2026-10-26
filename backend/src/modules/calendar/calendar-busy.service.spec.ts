import {afterEach, describe, expect, it, vi} from 'vitest';
import {CalendarBusyService, isBusy} from './calendar-busy.service.js';
import {CALENDAR_CACHE_MS, CALENDAR_TIMEOUT_MS, type CalendarClient, type Interval} from './calendar.types.js';
import {parseServiceAccountKey} from './service-account-key.js';

const at = (h: number, m = 0) => new Date(Date.UTC(2030, 2, 5, h, m));
const slot = {startsAt: at(10), endsAt: at(10, 30)};
const busy = (s: Date, e: Date): Interval[] => [{start: s, end: e}];

afterEach(() => vi.useRealTimers());

describe('isBusy', () => {
  it('detects an event inside the slot', () => expect(isBusy(slot, busy(at(10, 10), at(10, 20)))).toBe(true));
  it('detects an event covering the slot', () => expect(isBusy(slot, busy(at(9), at(11)))).toBe(true));
  it('detects overlap at the start edge', () => expect(isBusy(slot, busy(at(9), at(10, 1)))).toBe(true));
  it('detects overlap at the end edge', () => expect(isBusy(slot, busy(at(10, 29), at(11)))).toBe(true));
  it('treats back-to-back as free', () => {
    expect(isBusy(slot, busy(at(9, 30), at(10)))).toBe(false);
    expect(isBusy(slot, busy(at(10, 30), at(11)))).toBe(false);
  });
  it('treats an all-day event as busy', () => {
    expect(isBusy(slot, busy(new Date(Date.UTC(2030, 2, 5)), new Date(Date.UTC(2030, 2, 6))))).toBe(true);
  });
  it('is false with no intervals', () => expect(isBusy(slot, [])).toBe(false));
});

describe('parseServiceAccountKey', () => {
  const key = {client_email: 'sa@x.iam.gserviceaccount.com', private_key: 'PRIVATE', type: 'service_account'};
  const expected = {client_email: key.client_email, private_key: key.private_key};
  it('parses raw JSON', () => expect(parseServiceAccountKey(JSON.stringify(key))).toEqual(expected));
  it('parses base64 JSON', () => {
    expect(parseServiceAccountKey(Buffer.from(JSON.stringify(key)).toString('base64'))).toEqual(expected);
  });
  it('rejects invalid input', () => {
    expect(parseServiceAccountKey('not json')).toBeNull();
    expect(parseServiceAccountKey('')).toBeNull();
    expect(parseServiceAccountKey(undefined)).toBeNull();
    expect(parseServiceAccountKey('{"client_email":"a"}')).toBeNull();
  });
});

const sourceOf = (client: CalendarClient | null) => ({
  resolve: async () => ({client, source: client ? ('service_account' as const) : null}),
});

describe('CalendarBusyService', () => {
  const fake = (impl: CalendarClient['freeBusy']) => ({freeBusy: vi.fn(impl)});

  it('returns null when no client is configured', async () => {
    const svc = new CalendarBusyService(sourceOf(null));
    expect(await svc.isConnected()).toBe(false);
    expect(await svc.busyIntervals(at(0), at(23))).toBeNull();
  });

  it('returns intervals and serves repeats from the cache', async () => {
    const client = fake(async () => busy(at(10), at(11)));
    const svc = new CalendarBusyService(sourceOf(client));
    expect(await svc.isConnected()).toBe(true);
    expect(await svc.busyIntervals(at(0), at(23))).toHaveLength(1);
    await svc.busyIntervals(at(0), at(23));
    expect(client.freeBusy).toHaveBeenCalledTimes(1);
    await svc.busyIntervals(at(0), at(22)); // different range
    expect(client.freeBusy).toHaveBeenCalledTimes(2);
    await svc.busyIntervals(at(0), at(23), {fresh: true}); // bypass
    expect(client.freeBusy).toHaveBeenCalledTimes(3);
  });

  it('clearCache forces a new lookup', async () => {
    const client = fake(async () => []);
    const svc = new CalendarBusyService(sourceOf(client));
    await svc.busyIntervals(at(0), at(23));
    svc.clearCache();
    await svc.busyIntervals(at(0), at(23));
    expect(client.freeBusy).toHaveBeenCalledTimes(2);
  });

  it('expires the cache after 60 seconds', async () => {
    vi.useFakeTimers();
    const client = fake(async () => []);
    const svc = new CalendarBusyService(sourceOf(client));
    await svc.busyIntervals(at(0), at(23));
    vi.advanceTimersByTime(CALENDAR_CACHE_MS + 1);
    await svc.busyIntervals(at(0), at(23));
    expect(client.freeBusy).toHaveBeenCalledTimes(2);
  });

  it('returns null on Google errors and does not cache them', async () => {
    const client = fake(async () => {
      throw new Error('freeBusy HTTP 500');
    });
    const svc = new CalendarBusyService(sourceOf(client));
    expect(await svc.busyIntervals(at(0), at(23))).toBeNull();
    await svc.busyIntervals(at(0), at(23));
    expect(client.freeBusy).toHaveBeenCalledTimes(2);
  });

  it('returns null after 3 seconds even if the client ignores the abort signal', async () => {
    vi.useFakeTimers();
    const svc = new CalendarBusyService(sourceOf(fake(() => new Promise(() => undefined))));
    const result = svc.busyIntervals(at(0), at(23));
    await vi.advanceTimersByTimeAsync(CALENDAR_TIMEOUT_MS + 1);
    expect(await result).toBeNull();
  });
});
