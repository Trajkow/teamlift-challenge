# Phase 0: Repo Scaffold

**Status: ✅ done** · Depends on: — · Unblocks: 1, 2

## Goal
Get a git repo with a backend that boots against its own Postgres and a frontend that renders, with the shared
plumbing (errors, validation, API client, design tokens, shadcn components) in place.

## Read first
- `AGENTS.md`, `CLAUDE.local.md` if it exists, `docs/plans/README.md`, `teamlift_internship_challenge.md`

## Decisions
- Versions: Nest 12, Prisma 7 (`pg` driver adapter, `prisma-client` generator), Next 16.4.3, React 19.2.8, zod 4,
  Tailwind 4, shadcn (Base UI). Pin them in `package.json`.
- One database role (`postgres` locally, the Neon owner in production). A single `DATABASE_URL` is enough. Keep
  `MIGRATE_DATABASE_URL` in `prisma.config.ts` (it falls back to `DATABASE_URL`) because Neon needs the direct URL for
  migrations.
- Code and comments use only this app's vocabulary (Host, Guest, Slot, Booking). No leftover names or comments from
  elsewhere.

## Tasks

### 0.1 Git
- `git init -b main` in the project root. The root `.gitignore` already exists; extend it if needed.
- Keep `teamlift_internship_challenge.md` in the repo; the README links to it.
- **Accept:** `git status` shows no build output, secrets or `CLAUDE.local.md`.

### 0.2 Backend skeleton
- `backend/` with `package.json` (name `slot-backend`, ESM), `tsconfig*.json`, `nest-cli.json`, `oxlint.json`,
  `.prettierrc`, `vitest.config.ts`, `vitest.config.e2e.ts`, `prisma.config.ts`.
- Dependencies: Nest core + `@nestjs/platform-express`, `@nestjs/throttler`, `@prisma/client`, `@prisma/adapter-pg`,
  `pg`, `zod`, `luxon`. Dev: `prisma`, vitest, supertest, oxlint, prettier, `@nestjs/testing`, types.
- Scripts: `build`, `start:dev` (`nest start --watch --exec "node --env-file=.env"`, with `prestart:dev` running
  `db:up`), `start:prod`, `lint`, `test`, `test:e2e`, `db:up`, `db:generate`, `db:migrate`, `db:reset`.
- `docker-compose.yml`: `postgres:16-alpine`, container `slot_db`, database `slot_db`, port `5433:5432`, and its own
  volume `slot_pg`.
- `src/main.ts` and `src/configure-app.ts` (shared with e2e):
  - `setGlobalPrefix('api')`;
  - JSON body capped at 100 kb;
  - CORS restricted to `FRONTEND_ORIGIN` (only needed for dev tools, because the browser goes through the Next
    proxy);
  - `disable('x-powered-by')`.
- `src/prisma/` holds `PrismaService` (the `pg` adapter, the client imported from `src/generated/prisma/client.js`)
  and a global `PrismaModule`.
- `src/common/`:
  - `errors/`: `AppError` and `DbExceptionFilter` (global), with a unit spec. The filter maps:
    - `AppError` to its own status and code;
    - `HttpException` to `HTTP_<status>`;
    - `P2002`/`23505` to 409 `CONFLICT`;
    - `23P01` to 409 `SLOT_OVERLAP`;
    - `P2025` to 404 `NOT_FOUND`;
    - everything else to 500 `INTERNAL`.
    - Unwrap driver-adapter errors to find the pg code (`err.cause`, `err.meta`).
  - `validation/zod-validation.pipe.ts`: on failure it returns 400
    `{ error: 'VALIDATION_FAILED', message, issues }`.
  - `health/health.controller.ts`: `GET /api/health` runs `SELECT 1`.
  - `rate-limit/`: throttler config read from env (Phase 1 wires it up).
- `prisma/schema.prisma`: just the generator (`prisma-client`, output `../src/generated/prisma`) plus the
  `postgresql` datasource, with no models yet (Phase 1 adds them).
- `.env.example`:
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/slot_db`
  - `MIGRATE_DATABASE_URL` (same value)
  - `PORT=3000`, `FRONTEND_ORIGIN=http://localhost:3001`
  - `APP_TIME_ZONE=Europe/Skopje`, `HOST_NAME=` and `HOST_KEY=` (empty)
  - `RATE_LIMIT_ENABLED=true`
  - `GEMINI_API_KEY=` and `GEMINI_MODEL=` (Phase 3)
- `.env.test`: the same values, but the database is `slot_test` and rate limits are off.
- `test/helpers/app.ts`: `createTestApp()` builds the app exactly like `main.ts`.
- **Accept:** `npm install && npm run start:dev` boots, and `curl localhost:3000/api/health` returns `{"status":"ok"}`.
  `npm run lint && npm test` pass.

### 0.3 Frontend skeleton
- `frontend/` (name `slot-frontend`): Next 16 App Router, TypeScript, Tailwind 4, shadcn (`components.json`, Base UI).
  Add `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `sonner`, `lucide-react` and
  `next-themes`.
- `next.config.ts` rewrites `/api/:path*` to `${BACKEND_URL}/api/:path*`, so the browser stays same-origin.
- `app/globals.css`: design tokens for light and dark themes (canvas, surface, label, hairline, field, primary,
  accent, success), the Liquid Glass utilities (`.glass`, `.glass-thick`, `.glass-selected`, `.ambient`) with their
  reduced-transparency fallback, `scroll-slim`, and the floating-chrome geometry variables. Document them in
  `docs/design-system.md`.
- `components/app-nav.tsx`: a floating glass capsule with the "Slot" brand mark, "Book" and "Host" links and a theme
  menu (System / Light / Dark). `components/mobile-tab-bar.tsx`: a floating glass tab bar below `md` with the same two
  links.
- `components/ui/`: button, input, label, field, textarea, select, dialog, sheet, popover, calendar, badge, card,
  skeleton, separator and sonner.
- `components/`: `responsive-modal` (a dialog on desktop, a sheet on mobile), `empty-state`, `error-state`,
  `page-header`, `page-skeleton` and `confirm-dialog`.
- `lib/`:
  - `api.ts`: `apiFetch<T>` and `ApiError { status, code, message, issues? }`;
  - `time.ts`: `formatInstant`, `formatDate`, `formatClock`, `todayIn`, `zonedParts`;
  - `forms.ts`: `applyIssues`;
  - `error-messages.ts`: `toastError`, `errorMessage`;
  - `query-client.tsx`, `use-now.ts` and `utils.ts`.
- `app/layout.tsx`: the theme provider, `QueryClientProvider` and `Toaster`, an ambient wash behind the nav,
  `AppNav`, `main` and `MobileTabBar`. Set the title to "Slot".
- `app/page.tsx`: a placeholder that renders a `PageHeader` and `GET /api/health` through `apiFetch`.
- `.env.example`: `BACKEND_URL=http://localhost:3000`.
- **Accept:** `npm install && npm run dev` serves the placeholder on :3001, and it shows the backend health status
  through the proxy. `npm run lint && npm run typecheck && npm run build` pass.

### 0.4 Root docs stub
- Write a `README.md` stub with the title, a one-line description, and the run commands (Phase 5 writes the full
  README).

## Verification
```bash
cd backend && npm run lint && npm test && npm run build
cd ../frontend && npm run lint && npm run typecheck && npm run build
```

## Commits
- `chore: initialise repo and gitignore`
- `chore(backend): scaffold nest app with prisma, errors and validation`
- `chore(frontend): scaffold next app with shadcn and design tokens`

## Out of scope
Models, routes and UI flows (Phases 1 and 2).

## Handoff notes
- **Postgres:** `npm run db:up` (also run by `prestart:dev`) starts container `slot_db` on port 5433 and waits for the
  healthcheck. `backend/.env` is a copy of `.env.example` (git-ignored). `.env.test` points at `slot_test` on the same
  server; `test/global-setup.ts` drops and recreates it, then runs `prisma migrate deploy`, and refuses any other DB name.
- **Prisma:** `prisma/schema.prisma` has no models yet. The generated client lives in `src/generated/prisma/` and is
  git-ignored, so run `npm run db:generate` after a fresh clone and after schema edits (deploys must run it too, e.g. in
  the build command). `db:migrate` needs at least one model before it creates a migration. Phase 1 adds models and the
  raw-SQL constraints in the migration.
- **Backend helpers:** `src/common/errors/{app-error,db-exception.filter,error-codes,unique-violation}.ts`
  (`mapError` is exported and unit tested; `23P01` maps to `SLOT_OVERLAP`, `23505`/`P2002` to `CONFLICT`, and the
  deadlock codes to `CONCURRENT_MODIFICATION`; Phase 1 should map `23505` on `booking.slot_id` to `SLOT_TAKEN` in the
  service by catching it with `isUniqueViolation`). `src/common/validation/zod-validation.pipe.ts`,
  `src/common/rate-limit/rate-limit.ts` (global `AppThrottlerGuard` is registered; use `@RateLimit.booking()` on the
  booking route; env `RATE_LIMIT_ENABLED`, `RATE_LIMIT_DEFAULT_PER_MIN`, `RATE_LIMIT_BOOKING_PER_MIN`,
  `TRUST_PROXY`), `src/configure-app.ts` (prefix `api`, 100kb JSON limit, CORS, trust proxy).
- **Throttler guard** is tracker = client IP (the base ThrottlerGuard default). Phase 1.6's host key guard is not
  written yet; add it as a new guard, not in `app.module.ts` globals unless it checks the `/api/host` prefix.
- **E2E harness:** `test/helpers/app.ts` `createTestApp()` returns `{ app, server, http }`; env is loaded from
  `.env.test.local` then `.env.test` by `test/helpers/setup-env.ts`. There are no e2e specs yet, and the e2e config
  includes `**/*.e2e-spec.ts`.
- **ESM quirk:** backend relative imports end in `.js`; Prisma is imported from `src/generated/prisma/client.js`.
  `tsconfig.json` has no `rootDir`, so `tsc --noEmit -p tsconfig.json` also type-checks `test/`.
- **Frontend:** `package-lock.json` is committed because `@hookform/resolvers@6` has an optional peer conflict that
  fails a lockless `npm install` with ERESOLVE; keep using `npm install` with the lock (CI should use `npm ci`).
  `.env.local` (git-ignored) was copied from `.env.example`.
- **Frontend files:** `lib/api.ts` (`apiFetch`, `ApiError`, no credentials/idempotency), `lib/schemas/error.ts`
  (error body schema), `lib/time.ts` (`formatInstant`, `formatDate`, `formatClock`, `todayIn`, `zonedParts`, plus
  `zonedTimeToInstant`, `addDays`, `startOfWeek`), `lib/forms.ts` (`applyIssues`), `lib/error-messages.ts`
  (`MESSAGES` already has the Slot error codes; add new ones there), `lib/query-client.tsx` (`Providers`: theme, query
  client, Toaster), `lib/use-now.ts`. `components/status-badge.tsx` takes `booked: boolean`.
  `components/ui/` holds the full set, including dropdown-menu, tabs, checkbox, switch and table.
- **Layout:** the nav capsule (`components/app-nav.tsx`) shows Book / Host and a theme menu; the mobile tab bar has
  the same two tabs. `app/page.tsx` is a placeholder (health badge) that Phase 2 replaces; there is no `/host` route
  yet. Layout page padding at the bottom is `--page-pad-bottom`; floating bars use the geometry variables in
  `globals.css`.
- `docs/design-system.md` was trimmed to this app. `README.md` is a stub for Phase 5.
