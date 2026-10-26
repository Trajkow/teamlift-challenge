/** A busy period from the host calendar (half-open: [start, end)). */
export type Interval = {start: Date; end: Date};

/** The slice of the calendar integration that the service uses; tests provide a fake. */
export type CalendarClient = {
  /** Busy intervals between `from` and `to`. Rejects on any failure. */
  freeBusy(from: Date, to: Date, signal: AbortSignal): Promise<Interval[]>;
};

export const CALENDAR_CLIENT = Symbol('CALENDAR_CLIENT');
export const CALENDAR_TIMEOUT_MS = 3_000;
export const CALENDAR_CACHE_MS = 60_000;

export type CalendarSourceName = 'oauth' | 'service_account';

/** What the resolver chose for this request. `client` is null when nothing usable is configured. */
export type CalendarSource = {client: CalendarClient | null; source: CalendarSourceName | null};
