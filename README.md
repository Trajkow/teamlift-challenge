# Slot

A small scheduling app in the shape of a coffee chat / office hours page: one host publishes time slots, and anyone
can book one with their name and email. A slot can never be booked twice. Built for the
[TeamLift internship challenge](teamlift_internship_challenge.md).

- **Live app:** <LIVE_URL>
- **API health check:** <API_URL>/api/health (the free Render instance sleeps, so the first load can take up to a minute)
- **Video walkthrough (2 min):** _link goes here if recorded_

<!-- TODO(author): add screenshots of the guest page (/), the booking success screen and the host page (/host) in
docs/screenshots/ and link them here. -->

## What it does

| Brief requirement | Where |
|---|---|
| 1. Create available slots (date, start time, duration) | `/host`, "Publish slots". One start time plus a count creates back-to-back slots. |
| 2. See the list of available slots | `/`, a day strip and a grid of time pills in the one time zone. |
| 3. Book a slot with name and email | Click a pill, fill in the form, get a confirmation with an "Add to calendar" `.ics` download. |
| 4. A booked slot is no longer available | Booked slots stay on the page, greyed out and labelled "Booked". The database refuses a second booking. |

Both optional extras are in:

- **AI:** the success screen shows a short, friendly confirmation message written by Gemini (Google AI Studio free tier).
  Without a key, or when Gemini fails, a built-in template is shown instead.
- **Google Calendar:** the host clicks "Connect Google Calendar" on `/host`. Slots that clash with an event in that
  calendar show as "Busy" to guests and cannot be booked. Only free/busy times are read, never event titles.

The host can also delete an unbooked slot and cancel a booking (the slot becomes available again).

## How it works

```
Browser ──► Vercel (Next.js, proxies /api/*) ──► Render (NestJS API) ──► Neon (PostgreSQL)
                                                        ├──► Gemini        (confirmation message)
                                                        └──► Google Calendar (free/busy)
```

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, react-hook-form + zod.
  Apple-style look with light and dark themes.
- **Backend:** NestJS 12, Prisma 7, PostgreSQL 16, zod for validation, luxon for time zones.
- The browser only talks to the Next.js app, which forwards `/api/*` to the backend, so there is no CORS setup.

### How double booking is prevented

The guarantee lives in the database, not in app code:

- `booking.slot_id` is `UNIQUE`. Two requests for the same slot both pass any "is it free?" check, but the database
  accepts only one insert. The API turns the unique violation into `409 SLOT_TAKEN`.
- An exclusion constraint on `slot` (`EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)`) stops two
  slots from overlapping. It is mapped to `409 SLOT_OVERLAP`.
- `backend/test/bookings.concurrency.e2e-spec.ts` fires 20 parallel booking requests at one slot and expects exactly
  one `201` and nineteen `409`. A similar test covers parallel slot creation.

The checks in the service only exist to give clearer error messages. They are not what keeps the data correct.

## Run it locally

Needs Node 24, npm and Docker (for PostgreSQL).

```bash
# Backend: http://localhost:3000 (starts Postgres in Docker on port 5433)
cd backend
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run start:dev

# Frontend: http://localhost:3001 (proxies /api to the backend)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Optional demo data (10 half-hour slots over the next 5 weekdays and one booking), from `backend/`: `npm run seed`.

Tests (from `backend/`; the e2e tests use a separate `slot_test` database on the same Postgres):

```bash
npm test            # unit tests
npm run test:e2e    # API tests, including the 20-parallel-bookings test
```

From `frontend/`: `npm run typecheck`.

Optional settings in `backend/.env` (all documented in `.env.example`):

- `GEMINI_API_KEY` (and `GEMINI_MODEL`): real AI messages. Get a free key in Google AI Studio.
- `GOOGLE_OAUTH_*` and `CALENDAR_TOKEN_KEY`: the "Connect Google Calendar" button.
  `GOOGLE_CALENDAR_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`: a fallback calendar without sign-in.
  Setup steps are in [docs/deploy.md](docs/deploy.md). Without any of these, the app works and the extras switch off.
- `HOST_KEY`: when set, `/api/host/*` needs an `X-Host-Key` header and `/host` asks for the key.

Deploying (Neon + Render + Vercel) is described in [docs/deploy.md](docs/deploy.md).

## Choices I made

- **No accounts.** The brief says to assume one host, so `/host` is open on the live demo and reviewers can try it.
  An optional `HOST_KEY` switches protection on; it is off on the demo on purpose.
- **One time zone.** All times are stored as UTC instants and shown in `APP_TIME_ZONE` (default `Europe/Skopje`),
  and the UI says so. The backend turns a date and start time into an instant in that zone.
- **Booked and busy slots stay visible.** Greyed out and labelled "Booked" or "Busy", so it is clear why a time is
  gone. Past slots are hidden. Public responses never include a guest's name or email; only `/api/host/*` does.
- **Database constraints over app checks** for no double booking and no overlapping slots (see above).
- **AI is a separate endpoint with a template fallback.** `POST /api/bookings/:id/confirmation-message` has a 5 s
  timeout, strips markdown and links from the output, and stores the first AI text it gets. Booking never depends on
  it. If Gemini fails, the guest sees the template.
- **Google Calendar fails open.** If Google is slow (over 3 s) or unreachable, slots show as free and booking
  still works. A booking re-checks the calendar for that one slot and returns `409 SLOT_UNAVAILABLE` if it clashes.
  The host's OAuth refresh token is stored encrypted (AES-256-GCM), is never logged or returned, and only the
  free/busy scope is requested.
- **Small on purpose.** No auth, no multi-tenancy, no booking state machine.

## AI tools I used

<!-- TODO(author): review and rewrite in your own words -->

I built this with Claude Code. The work was split into phase plans in [docs/plans/](docs/plans/README.md) (scaffold,
backend, frontend, AI, deploy, README, Google Calendar, host OAuth), and agents executed those plans one phase at a
time on their own branches, following the rules in [AGENTS.md](AGENTS.md). Lint and build ran only when a phase branch
was merged, and I reviewed each phase before merging. Fixes made during review and merges include
retrying requests with backoff for the free-tier cold start, polishing the overlap error message and the host time
column, logging the reason when the calendar check fails, and rejecting truncated auth tags when decrypting the
calendar token. Gemini is used inside the app for the confirmation message.

## With more time

- Real host authentication, and multiple hosts.
- Email confirmations, and guest self-cancel through a signed link.
- Recurring weekly availability.
- Playwright end-to-end tests in CI (CI today runs lint, unit and API tests, type check and build).
- Persist the Google OAuth state outside memory so a backend restart during consent doesn't lose it.
