# Phase 6: Second Extra (Google Calendar Conflicts)

**Status: ✅ done (live Google call unverified)** · Depends on: 1, 2, 3 · Unblocks: 5 (README mentions both extras)

## Goal
The brief's first optional extra: connect the host's Google Calendar so slots that clash with existing events are
**marked as unavailable**. Guests can't book them, and the host sees why.

## Prerequisites
- Approved package: `google-auth-library` (service account JWT auth). Call the Calendar REST API with `fetch`; don't
  add `googleapis` (too large for one endpoint).
- The user provides the service account key and calendar ID later (see "User setup" below). Build and test
  everything with a mocked client, so no key is needed to finish this phase.

## Decisions
- **Auth: a service account, not OAuth.** There's one host and no accounts, so a per-user OAuth flow would be overkill.
  The host shares their calendar with the service account's email ("See only free/busy" is enough).
- **API: `POST https://www.googleapis.com/calendar/v3/freeBusy`** with scope
  `https://www.googleapis.com/auth/calendar.freebusy`. It returns busy intervals only, never event titles or details.
- **Marked, not hidden.** A clashing slot stays in the guest list as "Busy", the same way booked slots stay visible.
  This makes the feature visible to reviewers.
- **Overlap rule:** a slot clashes when `slot.startsAt < busy.end && busy.start < slot.endsAt` (half-open, so
  back-to-back is not a clash).
- **Fail open.** If Google is unreachable, slow (3 s timeout) or not configured, slots are shown as normal and a
  warning is logged (no event data, no PII). Calendar trouble must never break listing or booking.
- **Cache** free/busy results in memory for 60 s, keyed by the queried range. One backend instance, so in-memory is
  fine.
- **Booking re-check:** `POST /api/slots/:id/bookings` checks free/busy for that one slot (bypassing the cache) and
  returns 409 `SLOT_UNAVAILABLE` if it clashes. If the check fails, the booking goes through (fail open).
- Env vars, both optional, feature off when either is missing:
  - `GOOGLE_CALENDAR_ID`: the calendar to check (usually the host's Gmail address).
  - `GOOGLE_SERVICE_ACCOUNT_JSON`: the service account key file contents, either raw JSON or base64 of it (Render
    env vars handle base64 more safely). Never log it, never commit it.

## API changes (update the API map in `README.md`)
- `PublicSlot` gains `isBusy: boolean` (true when the slot clashes with a calendar event and isn't booked). `HostSlot`
  inherits it.
- `GET /api/config` gains `calendarConnected: boolean` (true when both env vars are set).
- New error: 409 `SLOT_UNAVAILABLE`, "This time clashes with the host's calendar."

## Tasks

### 6.1 `calendar` module (`backend/src/modules/calendar/`)
- `calendar.module.ts`, `google-calendar.client.ts` (JWT from `google-auth-library`, `fetch` to freeBusy, 3 s
  `AbortController` timeout), `calendar-busy.service.ts`:
  - `busyIntervals(from: Date, to: Date): Promise<Interval[] | null>`: `null` means unknown (not configured or failed);
  - `isBusy(slot, intervals)`: a pure helper with the overlap rule;
  - the 60 s cache.
- Inject the client through a token (`CALENDAR_CLIENT`) so tests pass a fake, like the AI module does.
- Parse `GOOGLE_SERVICE_ACCOUNT_JSON` once at startup: try JSON, then base64-decoded JSON. If it's invalid, log one
  warning and treat the feature as off.
- **Accept:** unit specs for the overlap rule (inside, overlapping each edge, back-to-back, all-day event), key parsing
  (raw, base64, invalid), cache hit, timeout, and Google errors returning `null`.

### 6.2 Wire into slots
- `listPublic` and the host list fetch busy intervals for the listed range once, then set `isBusy` on each slot
  (`isBusy` is false for booked slots).
- `book()` re-checks the one slot and throws `SLOT_UNAVAILABLE`.
- `GET /api/config` returns `calendarConnected`.
- **Accept:** e2e with a fake client:
  - a busy slot shows `isBusy: true`, and booking it gives 409 `SLOT_UNAVAILABLE`;
  - when the client fails, the slot is `isBusy: false` and booking succeeds;
  - with no env, `calendarConnected` is false.

### 6.3 Frontend
- `lib/schemas/slots.ts`: add `isBusy` and `calendarConnected`.
- Guest slot pills: `isBusy` pills are disabled with a "Busy" label and muted style (not struck through, so it reads
  differently from Booked). Count them out of "N available".
- Host list: a busy slot gets a warning-tone "Calendar conflict" badge.
- Host page header: a small pill reading "Google Calendar connected" or "Calendar not connected", from config.
- `lib/error-messages.ts`: a friendly `SLOT_UNAVAILABLE` message. On that error, close the dialog and refetch, the same
  way as `SLOT_TAKEN`.

### 6.4 Docs
- `docs/deploy.md`: a "Google Calendar (optional)" section with the user setup steps below.
- `render.yaml`: add both env vars with `sync: false`. `backend/.env.example`: add them, empty.
- `README.md` (API map, error table, status) and these Handoff notes.

## User setup (goes into `docs/deploy.md`)
1. https://console.cloud.google.com → create a project, then **APIs & Services → Enable APIs** → enable **Google
   Calendar API**.
2. **IAM & Admin → Service Accounts → Create** (no roles needed). Open it → **Keys → Add key → JSON**, which downloads
   the key file.
3. In Google Calendar (web) → **Settings → your calendar → Share with specific people** → add the service account's
   email with **See only free/busy**.
4. Set `GOOGLE_CALENDAR_ID` (your calendar's ID from "Integrate calendar", usually your Gmail address) and
   `GOOGLE_SERVICE_ACCOUNT_JSON` (`base64 -w0 key.json`) in `backend/.env` locally and on Render.

## Verification
```bash
cd backend && npm test && npm run test:e2e
cd ../frontend && npm run typecheck
```
Live check after the user adds the key: create a slot that overlaps a real calendar event, and see it as Busy on `/`.

## Commits
- `feat(calendar): add google calendar free/busy client with cache and fail-open`
- `feat(slots): mark slots that clash with the host calendar`
- `feat(frontend): show busy slots and calendar status`
- `docs: add google calendar setup`

## Out of scope
Writing bookings into the calendar, OAuth, multiple calendars.

## Handoff notes
- **Built:** `backend/src/modules/calendar/`: `calendar.types.ts` (`CalendarClient`, `CALENDAR_CLIENT` token, 3 s
  timeout, 60 s cache constants), `service-account-key.ts` (raw JSON or base64), `google-calendar.client.ts`
  (`google-auth-library` `JWT.getAccessToken()` + `fetch` to freeBusy, zod-parsed response),
  `calendar-busy.service.ts` (`busyIntervals`, pure `isBusy`, cache, timeout, never throws), `calendar.module.ts`
  (factory provider: real client, or `null` = feature off). The 3 s timeout lives in the service (it passes an
  `AbortSignal` to the client and also races it), so it covers fake clients too.
- **Wiring:** `SlotsService` fetches busy intervals once per list (min start to max end of the listed slots) for the
  public and host lists; `book()` re-checks that single slot with `fresh: true` (skips the cache) after the
  `SLOT_TAKEN` check and throws 409 `SLOT_UNAVAILABLE`. `isBusy` is never true for a booked slot. `calendarConnected`
  in `/api/config` is true when the client exists (both env vars set and the key parses).
- **Frontend:** Busy pills (muted, label "Busy", not struck through, always shown regardless of "Show booked", not
  counted in "N available"); host rows get a warning "Calendar conflict" badge; host header pill shows
  connected/not connected; `SLOT_UNAVAILABLE` has a message and closes the dialog and refetches like `SLOT_TAKEN`.
- **Tests:** unit specs for overlap (inside, both edges, back-to-back, all-day), key parsing, cache hit/expiry,
  Google errors and timeout; e2e `test/calendar.e2e-spec.ts` with an injected fake client (busy + 409, fail open,
  back-to-back, cache bypass on booking, no-env config). No test calls Google.
- **Unverified:** the live Google call (no service account was available): auth scope, the freeBusy request/response
  handling and sharing permission ("See only free/busy") are untested against the real API. Follow the "Google
  Calendar" section of `docs/deploy.md` and set `GOOGLE_CALENDAR_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`.
- **Known limit:** Google may reject very long freeBusy ranges (the host list covers all upcoming slots); that fails
  open and shows slots as not busy.
- Never logged: key, event data, guest PII (only the error class name is logged).
