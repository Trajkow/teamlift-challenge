/**
 * Demo data: 10 half-hour slots (10:00 and 14:00) over the next 5 weekdays in APP_TIME_ZONE, one of them booked by a
 * fictional guest. Safe to re-run: slots that overlap existing ones are skipped and the demo booking is made once.
 * Works against any DATABASE_URL (local, Neon). Run with `npm run seed` from `backend/`.
 * Plain `pg` + luxon only, so Node can run this file directly without a build step.
 */
import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const zone = process.env.APP_TIME_ZONE || 'Europe/Skopje';
const START_TIMES = ['10:00', '14:00'];
const DURATION_MINUTES = 30;
const WEEKDAYS = 5;
const GUEST = {name: 'Ana Petrova', email: 'ana@example.com', note: 'Would love to chat about career paths.'};

function plannedSlots(): {startsAt: Date; endsAt: Date}[] {
  const slots: {startsAt: Date; endsAt: Date}[] = [];
  let day = DateTime.now().setZone(zone).startOf('day');
  for (let found = 0; found < WEEKDAYS; ) {
    day = day.plus({days: 1});
    if (day.weekday > 5) continue;
    found++;
    for (const time of START_TIMES) {
      const [hour, minute] = time.split(':').map(Number);
      const start = day.set({hour, minute});
      slots.push({startsAt: start.toJSDate(), endsAt: start.plus({minutes: DURATION_MINUTES}).toJSDate()});
    }
  }
  return slots;
}

const client = new pg.Client({connectionString: url});
await client.connect();
try {
  const created: {id: string; startsAt: Date}[] = [];
  let skipped = 0;
  for (const slot of plannedSlots()) {
    // The exclusion constraint is the real guard; the NOT EXISTS check just avoids noisy errors.
    const res = await client.query(
      `INSERT INTO slot (id, starts_at, ends_at)
       SELECT $1::uuid, $2::timestamptz, $3::timestamptz
       WHERE NOT EXISTS (
         SELECT 1 FROM slot WHERE tstzrange(starts_at, ends_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [randomUUID(), slot.startsAt, slot.endsAt],
    );
    if (res.rowCount) created.push({id: res.rows[0].id, startsAt: slot.startsAt});
    else skipped++;
  }

  let booked = false;
  const existing = await client.query('SELECT 1 FROM booking WHERE email = $1 LIMIT 1', [GUEST.email]);
  if (!existing.rowCount) {
    // Book the earliest free slot of the demo set (newly created ones first, else any future free slot).
    const target =
      created[0]?.id ??
      (
        await client.query(
          `SELECT s.id FROM slot s LEFT JOIN booking b ON b.slot_id = s.id
           WHERE b.id IS NULL AND s.starts_at > now() ORDER BY s.starts_at LIMIT 1`,
        )
      ).rows[0]?.id;
    if (target) {
      const res = await client.query(
        `INSERT INTO booking (id, slot_id, name, email, note) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [randomUUID(), target, GUEST.name, GUEST.email, GUEST.note],
      );
      booked = !!res.rowCount;
    }
  }
  console.log(`Seed done (${zone}): ${created.length} slots created, ${skipped} skipped, demo booking ${booked ? 'created' : 'already present'}.`);
} finally {
  await client.end();
}
