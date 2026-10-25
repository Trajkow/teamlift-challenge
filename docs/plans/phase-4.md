# Phase 4: Deploy

**Status: 🚧 in progress (repo prep done; deploy pending user accounts)** · Depends on: 1, 2 (3 if done) · Unblocks: 5

## Goal
Put the app on a public link. Reviewers will use it the way a real user would.

## Prerequisites (the user must do these; **stop and ask**)
- Push the repo to GitHub as a public repo, for example `trajkow/teamlift-challenge`. The agent can only push if the
  user has set up git credentials.
- Create a Neon project, Render and Vercel accounts, and share the Gemini key. The agent never creates accounts and
  never pastes secrets into files that get committed.

## Decisions
- **DB: Neon** (free). The app uses `DATABASE_URL` (pooled). Migrations use `MIGRATE_DATABASE_URL` (direct,
  non-pooled).
- **Backend: Render web service** (free, sleeps when idle). Root dir is `backend`.
  - Build: `npm ci && npx prisma generate --config prisma.config.ts && npx prisma migrate deploy --config prisma.config.ts && npm run build`
  - Start: `npm run start:prod`
  - Health check: `/api/health`
- **Frontend: Vercel.** Root dir is `frontend`, and the env var `BACKEND_URL=https://<render-service>.onrender.com`.
  The existing Next rewrite proxies `/api/*`, so the browser stays same-origin. Add `<vercel-domain>` to
  `FRONTEND_ORIGIN` on Render anyway.
- **Cold starts:** Render free instances sleep, and the first request can take about 30 to 50 s. The frontend
  `ErrorState` and skeleton must handle a slow first load gracefully. Add a one-line note to the README. Optionally,
  a GitHub Actions cron can ping `/api/health` every 10 minutes during the review week.
- **Host key in production: off** (decided by the user). Leave `HOST_KEY` unset on Render so reviewers can use
  `/host` without friction. The demo data is disposable, the rate limits cap abuse, and `npm run seed` restores the
  slots. The README's "Choices I made" says the key can be switched on with one env var.

## Tasks

### 4.1 Production readiness
- `backend/package.json`: make sure `start:prod` runs `node dist/main.js` and `prisma` is available at build time
  (move it to `dependencies` if Render prunes dev dependencies).
- Set `TRUST_PROXY=1` on Render so the rate limits see real client IPs.
- Optionally add `render.yaml` (a blueprint) so the setup is reproducible.
- Optionally add `backend/scripts/seed-demo.ts`, which creates about 10 slots across the next 5 weekdays. Add an
  `npm run seed` script, run it once against production, and mark one slot as booked so reviewers see both states.

### 4.2 Deploy
- Deploy the backend, then the frontend, then run the seed.
- **Accept:** on the live URL, on desktop and phone:
  - create a slot on `/host` and see it on `/`;
  - book it, see the confirmation (and the AI message if Phase 3 is done);
  - in a second browser, see the slot as Booked;
  - booking it via `curl` gives 409.

### 4.3 CI (only if time allows)
- `.github/workflows/ci.yml`: backend lint, unit tests and e2e against a `postgres:16` service; frontend lint,
  typecheck and build.

## Verification
The Accept steps in 4.2, done on the live link.

## Commits
- `chore(deploy): add render blueprint and production start`
- `chore(backend): add demo seed script`
- `ci: add backend and frontend checks`

## Handoff notes
- **Done in the repo (4.1, 4.3):** `render.yaml` (root; free plan, root dir `backend`, health check `/api/health`,
  secrets `sync: false`), `npm run seed` (`backend/scripts/seed-demo.ts`, plain `pg` + luxon, run by Node directly),
  `npm run db:deploy`, `start:prod` = `node dist/main.js`, `.github/workflows/ci.yml`, `docs/deploy.md` (click-by-click
  checklist and env var table). **4.2 (real deploy) is not done: it needs the user's Neon, Render and Vercel accounts.**
- **Build on Render:** `npm ci --include=dev` (Render sets `NODE_ENV=production`, which would skip `prisma` and the Nest
  CLI), then `prisma generate`, `prisma migrate deploy`, `npm run build`. `TRUST_PROXY=1` was already wired in
  `configure-app.ts`. `sslmode=require` in the Neon URLs is passed through `PrismaPg` to `pg`; not testable locally
  (no SSL on the Docker Postgres), so confirm on the first Render deploy.
- **Seed:** 10 half-hour slots (10:00 and 14:00) on the next 5 weekdays in `APP_TIME_ZONE`, skipping any that overlap,
  plus one booking by "Ana Petrova" made once. Re-running is a no-op. It uses `pg` directly (no `tsx` installed, and the
  generated Prisma client can't be loaded by Node's type stripping).
- **Cold start:** `lib/query-client.tsx` now retries non-4xx errors 8 times with backoff (1, 2, 4, 8 s, then 8 s), about
  a minute, so the skeleton stays until the backend wakes up. Mutations still don't retry.
- **Checked locally:** production build + `start:prod` against a throwaway DB, seed twice, frontend `next build` and
  `next start` with `BACKEND_URL` proxying `/api` (see the report in the commit history of this phase). Throwaway DB dropped.
- **Still to do by the user:** follow `docs/deploy.md`, then record live URLs here and finish 4.2's Accept steps.
- Optional keep-warm: a GitHub Actions cron pinging `/api/health` every 10 minutes was not added.
