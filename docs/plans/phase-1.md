# Phase 1: Backend (Slots and Bookings)

**Status: ⏳ todo** · Depends on: 0 · Unblocks: 2 (end to end), 3, 4

## Goal
Build every route in the API map except the AI one. Postgres guarantees that a slot can't be booked twice and that
two slots can't overlap. Tests prove it under parallel requests.

## Read first
- `AGENTS.md`, `docs/plans/README.md` (API map, error table)
- `backend/src/common/errors/`, `backend/src/common/rate-limit/`, `backend/test/helpers/` (from Phase 0)

## Decisions
- Store `ends_at` explicitly. `timestamptz + interval` is only STABLE, not IMMUTABLE, so it can't go inside an
  exclusion constraint. `tstzrange(starts_at, ends_at, '[)')` can. `durationMinutes` in the API is derived as
  `(ends_at - starts_at)`.
- **Booking is one `INSERT`.** It isn't read-then-write. The `UNIQUE (slot_id)` constraint is the guard: catch
  `P2002`/`23505` on that insert and throw 409 `SLOT_TAKEN`. Do a pre-check (does the slot exist, is it in the
  future) before the insert, but only so the error is clearer.
- `onDelete: Restrict` from booking to slot, so a booked slot can't be deleted by accident. Deleting a slot with a
  booking gives 409 `SLOT_BOOKED`.
- Emails are trimmed and lowercased.

## Tasks

### 1.1 Schema and migration
```prisma
model Slot {
  id        String   @id @default(uuid()) @db.Uuid
  startsAt  DateTime @map("starts_at") @db.Timestamptz
  endsAt    DateTime @map("ends_at") @db.Timestamptz
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  booking   Booking?
  @@index([startsAt])
  @@map("slot")
}

model Booking {
  id                  String   @id @default(uuid()) @db.Uuid
  slotId              String   @unique @map("slot_id") @db.Uuid
  slot                Slot     @relation(fields: [slotId], references: [id], onDelete: Restrict)
  name                String
  email               String
  note                String?
  confirmationMessage String?  @map("confirmation_message") // Phase 3
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@map("booking")
}
```
- Run `npm run db:migrate -- --create-only --name init`, then add these lines to the generated SQL:
  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE slot ADD CONSTRAINT slot_ends_after_start CHECK (ends_at > starts_at);
  ALTER TABLE slot ADD CONSTRAINT slot_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&);
  ALTER TABLE booking ADD CONSTRAINT booking_name_len CHECK (char_length(name) BETWEEN 1 AND 80);
  ```
- Apply the migration and run `npm run db:generate`. Check that a second `migrate dev` reports no drift.
- **Accept:** in psql, inserting two overlapping slots fails with `23P01`, and inserting two bookings for one slot
  fails with `23505`.

### 1.2 DTOs (`src/modules/slots/dto/`)
- `create-slots.dto.ts`, `create-booking.dto.ts` and `list-slots.dto.ts`: zod schemas exactly as in the README's
  validation list. Export the inferred types.
- `slot.mapper.ts`: `toPublicSlot(slot & { booking })` and `toHostSlot(...)`. Only `toHostSlot` may read booking PII.
- **Accept:** unit spec for the schemas, including bad time, duration out of range, count out of range, bad email
  and an over-long note.

### 1.3 Time helper (`src/modules/slots/slot-time.ts`)
- `toInstant(date, startTime, zone)` uses luxon `DateTime.fromISO(\`${date}T${startTime}\`, { zone })`.
  - Reject an invalid DateTime, which covers DST gaps.
  - Return `{ startsAt, endsAt }` for `count` back-to-back slots.
- **Accept:** unit spec, including one case on a DST change day in `Europe/Skopje`.

### 1.4 `SlotsService` + controllers
- `PublicSlotsController` (`/api/slots`, `/api/config`) and `HostSlotsController` (`/api/host/...`).
- `listPublic(from, to)` returns slots with `startsAt > now()` inside the range, including `booking: { select: { id: true } }`
  only, mapped by `toPublicSlot`.
- `createSlots(dto)`:
  - reject with `SLOT_IN_PAST` if the first slot isn't in the future;
  - insert all slots with `createMany` inside one `$transaction`;
  - return them, ordered.
  - An overlap fails the whole batch through the filter (409 `SLOT_OVERLAP`).
- `book(slotId, dto)`:
  - load the slot: 404 if it's missing, 422 `SLOT_IN_PAST` if it has started, and 409 `SLOT_TAKEN` early if it
    already has a booking;
  - then `prisma.booking.create`, and map the unique violation on `slot_id` to `SLOT_TAKEN`.
- `deleteSlot(id)` returns 409 `SLOT_BOOKED` when there's a booking and 404 when the slot is missing.
- `cancelBooking(id)` deletes the booking row and returns 404 when it's missing.
- `GET /api/config` returns `{ timeZone: APP_TIME_ZONE, hostName: HOST_NAME || null, hostKeyRequired: !!HOST_KEY }`.
- **Accept:** e2e (1.7).

### 1.5 Rate limits
- `@nestjs/throttler` with IP tracking only. The default is 120/min. Booking is
  10/min per IP. Host writes are 30/min. `RATE_LIMIT_ENABLED=false` turns it off (in `.env.test`).
- If Render sits behind a proxy, use `TRUST_PROXY=1` there (Phase 4).

### 1.6 Optional host key
- `HostKeyGuard` on `HostSlotsController`: when `HOST_KEY` is set, require `X-Host-Key`. Compare with
  `crypto.timingSafeEqual` on equal-length buffers. Otherwise return 401 `HOST_KEY_REQUIRED`.
- **Accept:** e2e covers both cases, with the key unset and with it set.

### 1.7 e2e tests (`test/slots.e2e-spec.ts`, `test/bookings.concurrency.e2e-spec.ts`)
- `test/global-setup.ts`: drop and recreate `slot_test`, then run `prisma migrate reset --force`.
- Each test uses its own future date, so tests don't collide on the overlap constraint. Use a helper like
  `uniqueFutureDate()` that spreads tests across days far in the future.
- Cases:
  - create one slot, then `count=4`, and check the times are back to back;
  - an overlapping slot gives 409 `SLOT_OVERLAP`;
  - a slot in the past gives 422;
  - book a slot: 201, and the public list now shows `isBooked: true` with **no name or email anywhere in the JSON**;
  - booking it again gives 409 `SLOT_TAKEN`;
  - deleting a booked slot gives 409 `SLOT_BOOKED`;
  - cancel the booking, then the slot can be booked again;
  - an unknown id gives 404;
  - validation errors give 400 with `issues`.
- **Concurrency:** send 20 `POST /bookings` in parallel (`Promise.all`) for one slot. Expect exactly one 201,
  nineteen 409 `SLOT_TAKEN`, and exactly one row in the DB.
- **Accept:** `npm run test:e2e` is green three times in a row.

## Verification
```bash
cd backend && npm test && npm run test:e2e
```

## Commits
- `feat(slots): add slot and booking schema with overlap and double-booking constraints`
- `feat(slots): add public and host slot routes`
- `feat(common): add rate limits and optional host key`
- `test(slots): add e2e and concurrent booking tests`

## Out of scope
Auth, email sending, the AI message (Phase 3), recurring rules and editing a slot (delete and re-create instead).

## Handoff notes
_(fill in: any change to response shapes, how to seed demo data)_
