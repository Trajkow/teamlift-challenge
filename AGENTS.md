# AGENTS.md: TeamLift Challenge ("Slot")

A small scheduling app for the TeamLift internship challenge (`teamlift_internship_challenge.md`). One host publishes
time slots and anyone can book one with their name and email. A slot can never be booked twice.

Keep it small: no auth, no multi-tenancy and no state machine. Reviewers grade it with a 2-hour build in mind.

## Layout
- `backend/`: NestJS 12, Prisma 7 (`pg` driver adapter), PostgreSQL 16, zod, luxon
    - `src/modules/slots/`: slots and bookings (controller + service + DTOs, Prisma used directly)
    - `src/modules/ai/`: LLM confirmation message (Gemini)
    - `src/common/`: errors, validation, rate limit, health
    - `src/generated/prisma/`: generated client, never edit
- `frontend/`: Next.js 16 (React 19, TypeScript), Tailwind 4, shadcn/ui (Base UI), TanStack Query, react-hook-form + zod
- `docs/plans/`: phase plans for agents (start at `docs/plans/README.md`)

## Commands
Backend (from `backend/`):
- Dev: `npm run start:dev` (starts Postgres in Docker on port **5433**, loads `.env`)
- Migrate: `npm run db:migrate`. Generate the client after schema edits: `npm run db:generate`
- Tests: `npm test` (unit) / `npm run test:e2e` (against `slot_test`). Lint: `npm run lint`

Frontend (from `frontend/`):
- Dev: `npm run dev` (http://localhost:3001, proxies `/api` to `BACKEND_URL`, default `http://localhost:3000`)
- Lint: `npm run lint`. Type check: `npm run typecheck`. Build: `npm run build`

## Backend rules
- Validate with zod and `ZodValidationPipe`. No class-validator.
- Errors are `{ error, message }` (plus `issues` on validation errors). Throw `AppError(status, code, message)`.
  `DbExceptionFilter` maps `P2002`/`23505` to 409 and `23P01` to 409 `SLOT_OVERLAP`.
- **Database constraints prevent double booking, not app checks.** `booking.slot_id` is `UNIQUE`, and an exclusion
  constraint stops two slots from overlapping. App-side checks only give clearer errors. Never remove these
  constraints or work around them.
- Store UTC instants (`timestamptz`). The one business time zone is `APP_TIME_ZONE` (default `Europe/Skopje`). The
  backend turns `date` + `startTime` into instants with luxon in that zone.
- Public responses never include booker name or email. Only `/api/host/*` returns them.
- ESM (`"type": "module"`, `nodenext`): relative imports end in `.js`. Import Prisma from
  `src/generated/prisma/client.js`, never `@prisma/client`.

## Frontend rules
- Look and feel: Apple-style, system font, neutral greys with one blue accent, pill buttons, large titles, inset
  grouped lists, light and dark themes. **Liquid Glass** (`.glass`, `.glass-thick`) only on the floating layer: the
  nav capsule, the mobile tab bar, the floating booking bar, dialogs, sheets, menus and popovers. Content (cards,
  lists, forms, slot pills) stays on solid `bg-card` surfaces. Full guide: `docs/design-system.md`.
- shadcn/ui for every primitive. Use design tokens (`bg-card`, `text-muted-foreground`, ...), never raw colours.
  Floating offsets come from the CSS variables in `globals.css` (`--nav-top`, `--float-bottom-tabbar`, ...).
- API calls go only through `apiFetch<T>()` in `lib/api.ts` (same-origin `/api`, throws `ApiError`).
- Data fetching uses TanStack Query (`features/<feature>/{api,hooks}.ts`). Forms use react-hook-form + `zodResolver`,
  with schemas in `lib/schemas/` that mirror the backend DTOs.
- Times go through `lib/time.ts` (`formatInstant`, `formatClock`, `todayIn`). Never call `Date.now()` during render
  (use `useNow()`).
- Next 16 differs from older versions: read `frontend/node_modules/next/dist/docs/` before using an unfamiliar API.
  `useSearchParams` needs a `<Suspense>` boundary.

## Naming
Use **Host** (publishes slots), **Guest** (books), **Slot**, **Booking**. Never User/Customer.

## Workflow
- Don't install packages that aren't pre-approved without asking. Pre-approved packages: the Phase 0 stack (Nest,
  Prisma, `pg`, zod, luxon, `@nestjs/throttler`, vitest, supertest, oxlint; Next, React, shadcn and its deps,
  TanStack Query, react-hook-form, `@hookform/resolvers`, sonner, lucide-react, next-themes), plus `@google/genai`
  (Phase 3).
- **Don't run `npm run lint` or `npm run build` while working.** Use `npm test`, `npm run test:e2e` and
  `npm run typecheck` instead. Lint and build run **only when a phase branch is merged** into `main` (see the merge
  step in `docs/plans/README.md`).
- Each phase is done on its own branch (`phase-<n>`), usually in its own git worktree, and merged into `main` when
  it's finished.
- Commits are single-line conventional commits (`feat(slots): add booking endpoint`).
- Never commit secrets: `.env` is git-ignored, and `.env.example` holds placeholders only.
- Keep scope tight. A working, polished flow beats extra features.
