import {describe, expect, it} from 'vitest';
import {toInstants} from './slot-time.js';

const zone = 'Europe/Skopje';

describe('toInstants', () => {
  it('reads the wall clock in the business zone (CEST = UTC+2)', () => {
    const [s] = toInstants('2030-07-01', '09:00', zone, 30)!;
    expect(s.startsAt.toISOString()).toBe('2030-07-01T07:00:00.000Z');
    expect(s.endsAt.toISOString()).toBe('2030-07-01T07:30:00.000Z');
  });
  it('builds back-to-back slots', () => {
    const r = toInstants('2030-07-01', '09:00', zone, 45, 3)!;
    expect(r).toHaveLength(3);
    expect(r[1].startsAt).toEqual(r[0].endsAt);
    expect(r[2].startsAt).toEqual(r[1].endsAt);
  });
  it('rejects an invalid date', () => {
    expect(toInstants('2030-02-31', '09:00', zone, 30)).toBeNull();
  });
  it('rejects a time inside the spring DST gap (2030-03-31, 02:00 to 03:00)', () => {
    expect(toInstants('2030-03-31', '02:30', zone, 30)).toBeNull();
    const [s] = toInstants('2030-03-31', '03:00', zone, 30)!;
    expect(s.startsAt.toISOString()).toBe('2030-03-31T01:00:00.000Z');
  });
  it('keeps real elapsed time across the DST change', () => {
    const r = toInstants('2030-03-31', '01:30', zone, 60, 2)!;
    // 01:30 CET = 00:30Z; the next hour is 03:30 CEST = 01:30Z
    expect(r[1].startsAt.toISOString()).toBe('2030-03-31T01:30:00.000Z');
  });
});
