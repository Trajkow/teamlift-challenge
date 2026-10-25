/** Time helpers on top of Intl (no date library). All instants are ISO strings or Dates. */

/** Formats an instant in the given zone, e.g. "Mon, Jun 1, 2026, 9:00 AM". */
export function formatInstant(
  instant: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(new Date(instant));
}

// ---------------------------------------------------------------------------------------------------------------
// Zone-aware date arithmetic on plain 'YYYY-MM-DD' / 'HH:mm' strings (no date library).
// ---------------------------------------------------------------------------------------------------------------

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock fields of an instant in a zone. */
export function zonedParts(instant: string | Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  const date = `${String(out.year).padStart(4, "0")}-${String(out.month).padStart(2, "0")}-${String(out.day).padStart(2, "0")}`;
  const time = `${String(out.hour).padStart(2, "0")}:${String(out.minute).padStart(2, "0")}`;
  // 0 = Sunday.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return { date, time, weekday };
}

/** Offset of `timeZone` from UTC at an instant, in ms (positive east of UTC). */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = partsFormatter(timeZone).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converts a wall-clock date + time in `timeZone` to the instant it denotes. A time skipped by a DST jump moves
 * forward; an ambiguous one (clocks go back) resolves to the earlier instant, like the backend.
 */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const DAY = 86_400_000;

  // The offsets in force just before and just after any transition near this wall time.
  const before = zoneOffsetMs(wall - DAY, timeZone);
  const after = zoneOffsetMs(wall + DAY, timeZone);
  const candidates = [...new Set([before, after])]
    .map((offset) => wall - offset)
    .filter((instant) => {
      const p = zonedParts(new Date(instant), timeZone);
      return p.date === date && p.time === time;
    });

  // Ambiguous (clocks go back): two instants match, take the earlier. Normal: one. Skipped (clocks go forward):
  // none match, so use the pre-transition offset, which lands on the same wall time moved forward.
  return new Date(candidates.length ? Math.min(...candidates) : wall - before);
}

/** Adds whole days to a 'YYYY-MM-DD' date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** Today's date in a zone. */
export function todayIn(timeZone: string): string {
  return zonedParts(new Date(), timeZone).date;
}

/** Formats a 'YYYY-MM-DD' date, e.g. "Mon, Jun 1". */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Formats just the clock time of an instant in a zone, e.g. "9:00 AM". */
export function formatClock(instant: string | Date, timeZone: string): string {
  return formatInstant(instant, timeZone, { timeStyle: "short" });
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
