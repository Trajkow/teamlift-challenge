import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {PrismaService} from '../src/prisma/prisma.service.js';
import {createTestApp, type TestApp} from './helpers/app.js';
import {uniqueFutureDate} from './helpers/slots.js';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

describe('concurrent bookings', () => {
  it('lets exactly one of 20 parallel bookings win', async () => {
    const created = await t.http
      .post('/api/host/slots')
      .send({date: uniqueFutureDate(), startTime: '14:00', durationMinutes: 30});
    expect(created.status).toBe(201);
    const slotId = created.body[0].id as string;

    const results = await Promise.all(
      Array.from({length: 20}, (_, i) =>
        t.http.post(`/api/slots/${slotId}/bookings`).send({name: `Guest ${i}`, email: `guest${i}@example.com`}),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
    for (const r of results.filter((r) => r.status === 409)) expect(r.body.error).toBe('SLOT_TAKEN');
    expect(await prisma.booking.count({where: {slotId}})).toBe(1);
  });

  it('keeps overlapping slot creation safe under parallel requests', async () => {
    const date = uniqueFutureDate();
    const results = await Promise.all(
      Array.from({length: 10}, () =>
        t.http.post('/api/host/slots').send({date, startTime: '16:00', durationMinutes: 30}),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of results.filter((r) => r.status !== 201)) {
      expect(r.status).toBe(409);
      expect(r.body.error).toBe('SLOT_OVERLAP');
    }
  });
});
