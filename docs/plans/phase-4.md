# Phase 4: Deploy

**Status: ⏳ todo** · Depends on: 1, 2 (3 if done) · Unblocks: 5

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
- **Host key in production:** set `HOST_KEY` on Render so random visitors can't wipe the slots, and put the key in the
  README and the submission email for reviewers. **Ask the user** whether they want this.

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
_(fill in: live URLs, the services' env var names (not values), the cold-start note)_
