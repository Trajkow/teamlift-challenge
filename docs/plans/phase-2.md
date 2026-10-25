# Phase 2: Frontend (Guest Booking + Host Page)

**Status: ✅ done** (end-to-end checks against the real backend are pending the merge with Phase 1) · Depends on: 0 (API contract in README); 1 for end-to-end checks · Unblocks: 3, 4

## Goal
Build a clean, calm UI that reviewers can use end to end in under a minute:
1. The host opens `/host`, creates slots, and sees who booked them.
2. A guest opens `/`, picks a slot, enters their name and email, and gets a confirmation.
3. The slot then shows as "Booked" to everyone else.

UI quality is the first thing TeamLift grades, so polish the states (loading, empty, error, conflict) more than you
add features.

## Read first
- `AGENTS.md`, `docs/plans/README.md` (API map), `docs/design-system.md`
- `frontend/lib/error-messages.ts`, `frontend/components/responsive-modal.tsx` (from Phase 0)
- Layout ideas: a day strip, a slot pill grid, and a floating booking bar on mobile

## Decisions
- Two routes: `/` (guest) and `/host` (host), linked from the glass nav capsule and the mobile tab bar (Phase 0).
- Follow `docs/design-system.md` exactly: large-title `PageHeader`, inset grouped lists, pill buttons, labels above
  filled inputs, glass only on the floating layer. On the guest page, once a slot is picked, a floating glass booking
  bar (date, time, "Book" pill) sits at the bottom (`--float-bottom-tabbar` on phones) and opens the booking dialog.
- Every page shows the business time zone from `GET /api/config` ("All times in Skopje time").
- TanStack Query: `useSlots()` sets `refetchOnWindowFocus` and `refetchInterval: 20_000`, so another person's booking
  shows up without a reload. Every booking or host mutation invalidates `['slots']` and `['host-slots']`.
- Use the brief's wording in the UI ("available", "booked") so reviewers can match each requirement to the screen.

## Tasks

### 2.1 Shared plumbing
- `lib/schemas/slots.ts`: zod mirrors of `CreateSlotsDto` and `CreateBookingDto`, each file starting with a comment
  naming the backend DTO it mirrors. Add the `PublicSlot`, `HostSlot` and `BookingConfirmation` types.
- `features/config/{api,hooks}.ts` provides `useAppConfig()`.
- `lib/error-messages.ts`: map `SLOT_TAKEN` to "Someone just booked this slot. Pick another one.",
  `SLOT_OVERLAP` to "This overlaps a slot you already published.", `SLOT_BOOKED` to "This slot has a booking. Cancel
  the booking first.", `SLOT_IN_PAST`, `RATE_LIMITED` and `HOST_KEY_REQUIRED`.
- `lib/host-key.ts`: read and write `X-Host-Key` in `localStorage`, wrapped in try/catch. `apiFetch` adds the header
  on `/host/*` calls.

### 2.2 Guest page `/`
- `features/booking/components/`:
  - `slot-list.tsx`: future slots grouped by day, using `formatDate` and `formatClock` in the config zone. Each day is
    a grouped card (`divide-y divide-hairline rounded-[22px] bg-card ring-1 ring-border`) of time pills.
    - Available pills are buttons. Booked pills are disabled, muted, struck through, labelled "Booked", and carry an
      `aria-label`.
    - Add a filter chip for "Show booked" (on by default) and a count of available slots per day.
  - `booking-dialog.tsx`: a `ResponsiveModal` (a dialog on desktop, a sheet on mobile). It holds a slot summary
    (date, time, duration) and a form for name, email and an optional note (react-hook-form + zodResolver, with
    `applyIssues` for backend issues). While submitting, the button is disabled and shows a spinner.
  - `booking-success.tsx`: shows a check mark, "You're booked", the slot time and the guest's name. Phase 3 adds the
    AI message here. Add an "Add to calendar" button that downloads an `.ics` file built on the client, which is
    cheap and a nice touch, and a "Book another" button.
- On a 409 `SLOT_TAKEN`: close the dialog, show `toastError`, and refetch slots. The pill flips to Booked, which shows
  the double-booking guard working.
- States:
  - loading: a `PageSkeleton`;
  - empty: an `EmptyState` with "No open slots right now, check back soon";
  - error: an `ErrorState` with a retry button.

### 2.3 Host page `/host`
- If `config.hostKeyRequired` and no key is stored, show a small card for entering the host key.
- `features/host/components/create-slots-form.tsx`:
  - a date picker (the shadcn `Calendar` in a `Popover`, past days disabled);
  - a start time `Input type="time"`;
  - a duration `Select` (15/30/45/60/90);
  - "How many back-to-back" (1 to 12).
  - Show a live preview line before submit, for example "Creates 4 slots: 10:00, 10:30, 11:00, 11:30".
  - On success, show a toast and reset the time field.
- `features/host/components/host-slot-list.tsx`: upcoming slots by day.
  - Each row shows the time, the duration, and a status badge ("Available" in muted, "Booked" in success). A booked
    row shows the guest's name, email (`mailto:` link) and note.
  - Actions: delete an available slot, or cancel a booking. Both go through `ConfirmDialog`.
  - A summary strip at the top shows "N upcoming, M booked".
- **Accept:**
  - create 4 slots, see them on `/`, book one as a guest, and see the guest's name on `/host`;
  - cancelling the booking makes the slot available on `/`;
  - an overlapping create shows the friendly toast.

### 2.4 Polish pass
- Check both themes, phone width (375 px, no horizontal scroll, 44 px targets), keyboard focus order, visible focus
  rings, and `prefers-reduced-motion`.
- Page titles and metadata. A favicon (a simple SVG).
- No console errors. No `Date.now()` during render.

## Verification
```bash
cd frontend && npm run typecheck
```
Manual check, with the backend running: run through the Accept steps in 2.3 at desktop and phone width.

## Commits
- `feat(frontend): add slot schemas, config hook and error messages`
- `feat(booking): add guest slot list, booking dialog and success screen`
- `feat(host): add create-slots form and host slot list`
- `style(frontend): responsive, theme and accessibility polish`

## Out of scope
Auth, editing slots, multiple hosts, a calendar grid view.

## Handoff notes
- **Phase 3 mount point:** `frontend/features/booking/components/booking-success.tsx`. A comment marks the spot
  between the booking summary and the "Add to calendar" / "Book another" buttons. The component receives the
  `BookingConfirmation` (`booking.id` is what `POST /api/bookings/:id/confirmation-message` needs). Add a
  `features/booking/api.ts` call and hook there.
- **Files:** `lib/schemas/slots.ts` (zod DTO mirrors + API types), `lib/host-key.ts` (`apiFetch` adds `X-Host-Key` on
  `/api/host/*`), `lib/ics.ts`, `lib/group-by-day.ts`, `components/day-header.tsx`, `features/config`,
  `features/booking` (`booking-page`, `slot-list`, `booking-dialog`, `booking-success`), `features/host`
  (`host-page`, `create-slots-form`, `host-slot-list`, `host-key-card`), routes `app/page.tsx` and `app/host/page.tsx`.
- **Verified:** `npm run typecheck` passes. Guest and host pages were exercised in a browser against a throwaway local
  mock (not committed): list, booked pills, booking form validation, success screen, host list and preview.
- **Not verified (needs the real backend):** the Accept steps in 2.3 end to end (create, book, cancel, overlap toast),
  the `SLOT_TAKEN` race, host key flow, and a 375 px visual pass in both themes.
- Backend shape assumed exactly as the API map: `DELETE` calls return 204 with no body (`apiFetch` returns undefined).
