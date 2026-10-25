import {describe, expect, it} from 'vitest';
import {createBookingSchema} from './create-booking.dto.js';
import {createSlotsSchema} from './create-slots.dto.js';
import {toHostSlot, toPublicSlot} from './slot.mapper.js';

const ok = {date: '2030-05-01', startTime: '09:30', durationMinutes: 30};

describe('createSlotsSchema', () => {
  it('accepts a valid body and defaults count to 1', () => {
    expect(createSlotsSchema.parse(ok)).toEqual({...ok, count: 1});
  });
  it.each([
    ['bad time', {startTime: '9:30'}],
    ['hour 24', {startTime: '24:00'}],
    ['bad date', {date: '2030-02-31'}],
    ['date format', {date: '01/05/2030'}],
    ['duration too short', {durationMinutes: 4}],
    ['duration too long', {durationMinutes: 241}],
    ['duration fraction', {durationMinutes: 30.5}],
    ['count too small', {count: 0}],
    ['count too big', {count: 13}],
  ])('rejects %s', (_n, patch) => {
    expect(createSlotsSchema.safeParse({...ok, ...patch}).success).toBe(false);
  });
});

describe('createBookingSchema', () => {
  it('trims the name and lowercases the email', () => {
    const r = createBookingSchema.parse({name: '  Ana ', email: ' Ana@Example.COM '});
    expect(r).toMatchObject({name: 'Ana', email: 'ana@example.com'});
  });
  it.each([
    ['empty name', {name: '  ', email: 'a@b.co'}],
    ['long name', {name: 'x'.repeat(81), email: 'a@b.co'}],
    ['bad email', {name: 'Ana', email: 'nope'}],
    ['long email', {name: 'Ana', email: `${'a'.repeat(250)}@b.co`}],
    ['long note', {name: 'Ana', email: 'a@b.co', note: 'x'.repeat(501)}],
  ])('rejects %s', (_n, body) => {
    expect(createBookingSchema.safeParse(body).success).toBe(false);
  });
  it('allows a 500 character note', () => {
    expect(createBookingSchema.safeParse({name: 'Ana', email: 'a@b.co', note: 'x'.repeat(500)}).success).toBe(true);
  });
});

describe('slot mappers', () => {
  const base = {id: 'i', startsAt: new Date('2030-01-01T10:00:00Z'), endsAt: new Date('2030-01-01T10:30:00Z')};
  it('public view never carries booker details', () => {
    const json = JSON.stringify(toPublicSlot({...base, booking: {id: 'b'}}));
    expect(json).not.toMatch(/name|email|note/);
    expect(JSON.parse(json)).toMatchObject({isBooked: true, durationMinutes: 30});
  });
  it('host view includes the booking', () => {
    const b = {id: 'b', name: 'Ana', email: 'a@b.co', note: null, createdAt: new Date('2030-01-01T00:00:00Z')};
    expect(toHostSlot({...base, booking: b}).booking?.name).toBe('Ana');
    expect(toHostSlot({...base, booking: null}).booking).toBeNull();
  });
});
