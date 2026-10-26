# Phase Plans

Execution plans for the TeamLift challenge app. Each phase file stands on its own, so an agent can pick one up
without any earlier conversation.

> **Deadline:** the challenge is due **October 25, 2026**. Phases 0 to 2 plus 4 to 5 are the critical path. Phase 3
> (AI) is the chosen optional extra. If time runs short, ship without it and list it under "with more time".

## Status

| Phase | File | Scope | Depends on | Status |
|-------|------|-------|------------|--------|
| 0 | [phase-0.md](phase-0.md) | Repo scaffold: git, backend + frontend skeletons, DB | — | ✅ done |
| 1 | [phase-1.md](phase-1.md) | Backend: slots, bookings, no-double-booking constraints, e2e + concurrency test | 0 | ✅ done |
| 2 | [phase-2.md](phase-2.md) | Frontend: guest booking page + host page | 0 (API contract below); 1 to test end to end | ✅ done (e2e vs real backend pending merge) |
| 3 | [phase-3.md](phase-3.md) | Optional extra: AI confirmation message (Gemini free tier) | 1, 2 | ✅ done (live Gemini call unverified) |
| 4 | [phase-4.md](phase-4.md) | Deploy: Neon (DB) + Render (API) + Vercel (web) | 1, 2 (3 if done) | ✅ done (live: https://teamlift-challenge.vercel.app) |
| 5 | [phase-5.md](phase-5.md) | README, final QA, submission email, video script | 4, 6, 7 | 🚧 in progress (README done; live URLs + author review pending) |
| 6 | [phase-6.md](phase-6.md) | Second extra: Google Calendar conflicts (free/busy, marked unavailable) | 1, 2, 3 | ✅ done (live Google call unverified) |
| 7 | [phase-7.md](phase-7.md) | Host connects Google Calendar on /host (OAuth, encrypted token, service account fallback) | 6 | ✅ done (live OAuth unverified) |
| 8 | [phase-8.md](phase-8.md) | Split-pill booking: the selected slot expands into "time │ Book →", floating bar removed | 2 | ⏳ todo |

```
0 ──► 1 ──┬──► 3 ──► 4 ──► 5
│         │    ▲
└──► 2 ───┴────┘
```

**Parallel work:** after Phase 0, one agent takes Phase 1 and another takes Phase 2. The Phase 2 agent codes against
the API map below. Phase 1 must not change a route or response shape without updating this file.

Status values: `⏳ todo`, `🚧 in progress (agent)`, `✅ done`, `⛔ blocked (reason)`.

## Settled decisions

| Topic | Decision |
|---|---|
| Theme ("make it your own") | **Coffee chat / office hours with one host.** The app is called "Slot". Change the copy in Phase 2 if the author picks something else. |
| Accounts | None, as the brief says. Host pages live at `/host`. Optional `HOST_KEY` (off on the live demo): if it's set, `/api/host/*` needs the `X-Host-Key` header. |
| Time zone | One zone, `APP_TIME_ZONE` (default `Europe/Skopje`), shown in the UI ("All times in Skopje time"). |
| Double booking | `UNIQUE (booking.slot_id)`. The database rejects the second insert, and the API maps that to 409 `SLOT_TAKEN`. Covered by a parallel-request e2e test. |
| Overlapping slots | Exclusion constraint `EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)`, mapped to 409 `SLOT_OVERLAP`. |
| Booked slots in the guest UI | Still shown, greyed out and labelled "Booked", so reviewers can see requirement 4. Past slots are hidden. |
| Cancel / delete | Host can delete an **unbooked** slot. Host can cancel a booking, which deletes the booking row and frees the slot. Guests can't cancel (no accounts). |
| Optional extras | **Both.** AI (Gemini, Phase 3) first, then Google Calendar conflicts (Phase 6). |
| Hosting | DB on Neon (free), backend on Render (free web service), frontend on Vercel. Vercel rewrites `/api/*` to Render, so the app is same-origin and needs no CORS work. |
| Ports | backend 3000, frontend 3001, Postgres **5433** (avoids clashing with other local Postgres instances on 5432). Container `slot_db`. |

## API map

All routes sit under `/api`. Instants are ISO 8601 UTC strings. `H` = needs `X-Host-Key` when `HOST_KEY` is set.

| Method & path | Who | Body / query | Response | Phase |
|---|---|---|---|---|
| `GET /api/health` | — | | `{ status: 'ok' }` | 0 |
| `GET /api/config` | — | | `{ timeZone, hostName, hostKeyRequired, calendarConnected }` | 1, 6 |
| `GET /api/slots` | — | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (optional, default today +30 days) | `PublicSlot[]` (future only, sorted by `startsAt`) | 1 |
| `POST /api/slots/:id/bookings` | — | `{ name, email, note? }` | 201 `BookingConfirmation` | 1 |
| `GET /api/host/slots` | H | `?includePast=false` | `HostSlot[]` | 1 |
| `POST /api/host/slots` | H | `{ date, startTime, durationMinutes, count? }` | 201 `HostSlot[]` | 1 |
| `DELETE /api/host/slots/:id` | H | | 204 | 1 |
| `DELETE /api/host/bookings/:id` | H | | 204 (slot becomes available again) | 1 |
| `POST /api/bookings/:id/confirmation-message` | — | | `{ message, source: 'ai' \| 'template' }` | 3 |
| `GET /api/host/calendar` | H | | `{ connected, source, email, needsReconnect, oauthAvailable }` | 7 |
| `GET /api/host/calendar/connect` | H (`?hostKey=`) | | 302 to Google consent | 7 |
| `GET /api/host/calendar/callback` | — (`state`) | `?code&state` | 302 to `/host?calendar=connected\|error` | 7 |
| `DELETE /api/host/calendar` | H | | 204 | 7 |

```ts
type PublicSlot = { id: string; startsAt: string; endsAt: string; durationMinutes: number; isBooked: boolean; isBusy: boolean }; // isBusy: Phase 6
type HostSlot = PublicSlot & { booking: { id: string; name: string; email: string; note: string | null; createdAt: string } | null };
type BookingConfirmation = { id: string; slot: PublicSlot; name: string; createdAt: string };
```

Validation:
- `date` is `YYYY-MM-DD` and `startTime` is `HH:mm` (24 h), both read in `APP_TIME_ZONE`.
- `durationMinutes` is an integer from 5 to 240.
- `count` is an integer from 1 to 12 and defaults to 1. It creates back-to-back slots in one transaction.
- `name` is 1 to 80 characters after trimming. `email` is a valid email of at most 254 characters. `note` is at
  most 500 characters.
- Slots must start in the future.

Error codes (`{ error, message }`):

| HTTP | `error` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` (+ `issues`) | bad body or query |
| 401 | `HOST_KEY_REQUIRED` | `HOST_KEY` is set and the header is missing or wrong |
| 404 | `NOT_FOUND` | unknown slot or booking |
| 409 | `SLOT_TAKEN` | slot already booked |
| 409 | `SLOT_OVERLAP` | new slot overlaps an existing one |
| 409 | `SLOT_UNAVAILABLE` | booking a slot that clashes with the host's Google Calendar (Phase 6) |
| 409 | `SLOT_BOOKED` | deleting a slot that has a booking |
| 422 | `INVALID_TIME` | slot start time falls in a daylight saving gap |
| 422 | `SLOT_IN_PAST` | booking or creating a slot in the past |
| 429 | `RATE_LIMITED` | throttler |
| 500 | `INTERNAL` | anything else (logged, details never leaked) |

## Agent protocol

1. **Read first:** `AGENTS.md`, `CLAUDE.local.md` if it exists, this README, your phase file, and the previous phase's **Handoff notes**.
2. **Before starting:** check that dependencies are `✅ done` (Phase 2 needs only Phase 0). Set your phase to
   `🚧 in progress`.
3. **Work task by task.** Each task lists files, steps and an **Accept** check. Don't skip the checks.
4. **Verify:** every command in the phase's Verification block must pass. **Don't run `npm run lint` or
   `npm run build`**; those run only at merge (step 8).
5. **Commit** with the suggested messages.
6. **Finish:** set the status to `✅ done`, fill in **Handoff notes**, and update the API map if anything changed.
7. **Stop and ask the user** when:
   - you need a package that isn't pre-approved;
   - you would have to change a route or response shape that another phase depends on;
   - you need an account, a secret or a dashboard action (Neon, Render, Vercel, Google AI Studio);
   - you would have to loosen a database constraint.
8. **Merge (done by the orchestrator, not the phase agent):** on the phase branch, run
   `cd backend && npm run lint && npm run build` and `cd frontend && npm run lint && npm run build`. Fix any failures
   on the branch, then merge into `main` with `git merge --no-ff phase-<n>`. This is the only time lint and build run.
