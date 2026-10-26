# Phase 8: Split-Pill Booking (Book Button on the Selected Slot)

**Status: ✅ done (browser checks unverified)** · Depends on: 2 · Frontend only

## Goal
Put the Book action where the guest is already looking. Clicking a free slot expands that pill in place into a split
pill, **time on the left and a blue "Book →" on the right**, and its neighbours reflow to make room (the pattern
Calendly uses). The floating glass booking bar at the bottom of the page goes away. One click selects, a second click
opens the existing booking dialog.

```
Friday, Oct 30 · 9 available
(10:00) (10:15̶) (10:30) [ 10:45 AM │ Book → ]
(11:00̶) (11:15) (11:30) (11:45) (12:00̶) (12:15)
```

## Read first
- `AGENTS.md`, `docs/design-system.md`, `docs/plans/README.md`
- `frontend/features/booking/components/slot-list.tsx` (the grid: `grid-cols-3 sm:grid-cols-4 lg:grid-cols-6`),
  `booking-page.tsx` (selection state and the floating bar to remove), `booking-dialog.tsx` (unchanged, reused)

## Decisions
- **Grid behaviour:** the selected pill becomes `col-span-2` (two cells wide) on every breakpoint. CSS grid
  auto-placement reflows the following pills, which is the "shift". On the 3-column phone grid a 2-wide pill still
  fits. If it lands in the last column it wraps to the next row, which is fine.
- **Split pill anatomy:** one rounded-full container with a hairline divider, using the same height and radius as the
  other pills:
  - **left half:** a button with the time, in the selected style. Clicking it again deselects.
  - **right half:** a solid `bg-primary text-primary-foreground` button labelled "Book" with an arrow icon. It opens
    the booking dialog.
  - Content stays on solid surfaces; no glass on pills (design-system rule).
- **Motion:** the width change and the "Book" half fading and sliding in take about 200 ms ease-out (`--duration`,
  `--ease-out` tokens). Use CSS transitions only, with no animation library. With `prefers-reduced-motion`, no
  animation (the global guard should already cover this).
- **Keyboard and accessibility:**
  - After selecting, move focus to the "Book" half, so Enter, Enter books.
  - `aria-pressed` on the time half, and an accessible name like "Book Friday, Oct 30 at 10:45 AM" on the Book half.
  - Escape on either half deselects and returns focus to the time button.
  - 44 px minimum targets below `md`.
- **Selection rules (unchanged):** booked and busy pills stay disabled. If the selected slot becomes booked or busy on
  a refetch, the selection clears, as today. Selecting another slot collapses the previous one.
- **Remove** the floating bar and its spacer from `booking-page.tsx`. The dialog, the `SLOT_TAKEN` and
  `SLOT_UNAVAILABLE` handling, and the success screen stay exactly as they are.
- **Duration hint:** put the duration ("15 min") under the time inside the left half in `text-caption`, as the
  booked pills already do with "Booked", so the guest still sees the length without the bar.

## Tasks

### 8.1 Split pill
- In `slot-list.tsx`, render the selected free slot as a `SplitSlotPill` (a new small component in the same feature
  folder) with `col-span-2`. Add an `onBook(slot)` prop next to `onSelect`.
- Use transitions for width, opacity and translate, matching the pill styling and focus rings used now (inset rings,
  `focus-visible`).

### 8.2 Page wiring
- In `booking-page.tsx`, pass `onBook`, which opens the dialog for that slot.
- Delete the floating bar markup, the spacer, and the `dayLabel` if nothing else uses it.
- Keep `selectedId` state and the clear-on-refetch logic.

### 8.3 Polish check (in a browser if one is available)
- Check desktop 1280 px, tablet 768 px and phone 375 px (3-column grid), in light and dark themes.
- Check a selection in the last column (it wraps cleanly).
- Check keyboard only: Tab, Enter on time, Enter on Book, Escape.
- No layout jump of other days, and no horizontal scroll.
- Booked and busy pills are unchanged.

## Verification
```bash
cd frontend && npm run typecheck
```
Plus the manual checks in 8.3.

## Commits
- `feat(booking): book from a split pill on the selected slot`
- `refactor(booking): remove the floating booking bar`

## Out of scope
Backend changes, the booking dialog's form, the host page.

## Handoff notes
- New `split-slot-pill.tsx`: `col-span-2` pill, time half (`aria-pressed`, duration caption, click deselects) and a
  solid primary "Book" half. Book focuses on mount and fades/slides in with a CSS transition (`duration-200 ease-out`,
  covered by the global reduced-motion guard). Escape on either half deselects and refocuses that slot's time button
  (found through `data-slot-time`).
- `SlotList` gained `onDeselect` and `onBook`; `BookingPage` wires them and no longer has the floating bar, spacer or
  `dayLabel`. Dialog, `SLOT_TAKEN`/`SLOT_UNAVAILABLE` handling and the success screen are untouched.
- Only `npm run typecheck` was run (passes). The 8.3 browser checks (breakpoints, themes, last-column wrap, keyboard
  flow) were not done: no browser run was set up.
