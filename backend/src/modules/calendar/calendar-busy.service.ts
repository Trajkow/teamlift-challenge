import {Inject, Injectable, Logger} from '@nestjs/common';
import {CalendarClientResolver} from './calendar-client.resolver.js';
import {CALENDAR_CACHE_MS, CALENDAR_TIMEOUT_MS, type CalendarSource, type Interval} from './calendar.types.js';

/** What the busy service needs from the resolver; tests pass a plain object. */
export type CalendarSourceProvider = {resolve(): Promise<CalendarSource>};

/** Half-open overlap: back-to-back (slot ends exactly when an event starts) is not a clash. */
export function isBusy(slot: {startsAt: Date; endsAt: Date}, intervals: Interval[]): boolean {
  return intervals.some((b) => slot.startsAt < b.end && b.start < slot.endsAt);
}

@Injectable()
export class CalendarBusyService {
  private readonly logger = new Logger(CalendarBusyService.name);
  private readonly cache = new Map<string, {at: number; intervals: Interval[]}>();

  constructor(@Inject(CalendarClientResolver) private readonly resolver: CalendarSourceProvider) {}

  /** True when a usable client exists right now (an OAuth connection that works, or the service account). */
  async isConnected(): Promise<boolean> {
    return !!(await this.resolver.resolve()).client;
  }

  /** Forget cached results, e.g. after the host connects or disconnects. */
  clearCache() {
    this.cache.clear();
  }

  /** Busy intervals in the range, or null when unknown (not configured, timeout or any failure). Never throws. */
  async busyIntervals(from: Date, to: Date, opts: {fresh?: boolean} = {}): Promise<Interval[] | null> {
    const {client} = await this.resolver.resolve();
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
