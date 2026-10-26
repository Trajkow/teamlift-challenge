import {Logger} from '@nestjs/common';
import {JWT} from 'google-auth-library';
import {z} from 'zod';
import type {CalendarClient, Interval} from './calendar.types.js';
import {parseServiceAccountKey, type ServiceAccountKey} from './service-account-key.js';

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

const responseSchema = z.object({
  calendars: z.record(
    z.string(),
    z.object({
      busy: z.array(z.object({start: z.string(), end: z.string()})).default([]),
      errors: z.array(z.unknown()).optional(),
    }),
  ),
});

/** Service-account JWT auth plus a plain fetch to the freeBusy endpoint (busy intervals only, no event details). */
export class GoogleCalendarClient implements CalendarClient {
  private readonly jwt: JWT;

  constructor(
    key: ServiceAccountKey,
    private readonly calendarId: string,
  ) {
    this.jwt = new JWT({email: key.client_email, key: key.private_key, scopes: [SCOPE]});
  }

  async freeBusy(from: Date, to: Date, signal: AbortSignal): Promise<Interval[]> {
    const {token} = await this.jwt.getAccessToken();
    if (!token) throw new Error('no access token');
    return fetchFreeBusy(token, this.calendarId, from, to, signal);
  }
}

/** One freeBusy call (busy intervals only). Shared by the service account and OAuth clients. */
export async function fetchFreeBusy(
  token: string,
  calendarId: string,
  from: Date,
  to: Date,
  signal: AbortSignal,
): Promise<Interval[]> {
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json'},
    body: JSON.stringify({timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{id: calendarId}]}),
    signal,
  });
  if (!res.ok) throw new Error(`freeBusy HTTP ${res.status}`);
  const parsed = responseSchema.parse(await res.json());
  const calendar = parsed.calendars[calendarId];
  if (!calendar) throw new Error('calendar missing from freeBusy response');
  if (calendar.errors?.length) throw new Error('freeBusy reported a calendar error');
  return calendar.busy.map((b) => ({start: new Date(b.start), end: new Date(b.end)}));
}

/** Builds the real client from env, or null (feature off) when either variable is missing or the key is invalid. */
export function createCalendarClientFromEnv(logger: Logger): CalendarClient | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!calendarId || !rawKey) return null;
  const key = parseServiceAccountKey(rawKey);
  if (!key) {
    logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON with client_email and private_key; calendar check is off');
    return null;
  }
  return new GoogleCalendarClient(key, calendarId);
}
