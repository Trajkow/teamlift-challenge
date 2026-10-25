import {DateTime} from 'luxon';

/** Turns a local `date` + `startTime` in `zone` into the instants of `count` back-to-back slots. */
export function toInstants(
  date: string,
  startTime: string,
  zone: string,
  durationMinutes: number,
  count = 1,
): {startsAt: Date; endsAt: Date}[] | null {
  const start = DateTime.fromISO(`${date}T${startTime}`, {zone});
  // Luxon moves a time inside a DST gap forward instead of failing, so compare the wall clock back.
  if (!start.isValid || start.toFormat('HH:mm') !== startTime) return null;
  const slots: {startsAt: Date; endsAt: Date}[] = [];
  for (let i = 0; i < count; i++) {
    const a = start.plus({minutes: i * durationMinutes});
    slots.push({startsAt: a.toJSDate(), endsAt: a.plus({minutes: durationMinutes}).toJSDate()});
  }
  return slots;
}

/** Start of the local day `date` in `zone`, shifted by `addDays`. */
export function startOfDay(date: string, zone: string, addDays = 0): Date {
  return DateTime.fromISO(date, {zone}).plus({days: addDays}).startOf('day').toJSDate();
}

export function todayIn(zone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, {zone}).toFormat('yyyy-MM-dd');
}

export function addDaysTo(date: string, days: number): string {
  return DateTime.fromISO(date, {zone: 'utc'}).plus({days}).toFormat('yyyy-MM-dd');
}
