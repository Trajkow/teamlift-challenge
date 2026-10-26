import {Inject, Injectable, Logger, Optional} from '@nestjs/common';
import {CALENDAR_CACHE_MS, CALENDAR_CLIENT, CALENDAR_TIMEOUT_MS, type CalendarClient, type Interval} from './calendar.types.js';

/** Half-open overlap: back-to-back (slot ends exactly when an event starts) is not a clash. */
export function isBusy(slot: {startsAt: Date; endsAt: Date}, intervals: Interval[]): boolean {
  return intervals.some((b) => slot.startsAt < b.end && b.start < slot.endsAt);
}

@Injectable()
export class CalendarBusyService {
  private readonly logger = new Logger(CalendarBusyService.name);
  private readonly cache = new Map<string, {at: number; intervals: Interval[]}>();

  constructor(@Optional() @Inject(CALENDAR_CLIENT) private readonly client?: CalendarClient | null) {}

  get connected(): boolean {
    return !!this.client;
  }

  /** Busy intervals in the range, or null when unknown (not configured, timeout or any failure). Never throws. */
  async busyIntervals(from: Date, to: Date, opts: {fresh?: boolean} = {}): Promise<Interval[] | null> {
    const client = this.client;
    if (!client) return null;
    const key = `${from.toISOString()}|${to.toISOString()}`;
    const hit = this.cache.get(key);
    if (!opts.fresh && hit && Date.now() - hit.at < CALENDAR_CACHE_MS) return hit.intervals;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CALENDAR_TIMEOUT_MS);
    try {
      const call = client.freeBusy(from, to, controller.signal);
      call.catch(() => undefined); // a late rejection after the timeout must not go unhandled
      // Race the abort signal so a client that ignores it still cannot hold the request past the timeout.
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('timeout')), {once: true}),
      );
      const intervals = await Promise.race([call, aborted]);
      this.remember(key, intervals);
      return intervals;
    } catch (err) {
      // The messages are our own (HTTP status, missing calendar) or auth errors; they hold no key or event data.
      const reason = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : 'unknown error';
      this.logger.warn(`Calendar free/busy check failed (${reason})`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private remember(key: string, intervals: Interval[]) {
    const now = Date.now();
    for (const [k, v] of this.cache) if (now - v.at >= CALENDAR_CACHE_MS) this.cache.delete(k);
    this.cache.set(key, {at: now, intervals});
  }
}
