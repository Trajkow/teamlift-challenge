# Phase 0: Repo Scaffold

**Status: ⏳ todo** · Depends on: — · Unblocks: 1, 2

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
_(fill in)_
