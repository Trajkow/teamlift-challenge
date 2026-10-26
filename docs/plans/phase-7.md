# Phase 7: Host Connects Google Calendar (OAuth)

**Status: ✅ done (live OAuth unverified)** · Depends on: 6 · Unblocks: 5

## Goal
Add a **"Connect Google Calendar"** button on `/host`. The host signs in with Google, and from then on every guest
sees slots that clash with that calendar as Busy. This replaces setting a service account key in env vars, which a
reviewer can't do. The Phase 6 service account stays as a fallback.

## Prerequisites
- No new packages: `google-auth-library` (already approved) has `OAuth2Client` (consent URL, code exchange, token
  refresh, revoke). Read its typings in `node_modules` instead of writing it from memory.
- The user creates the OAuth client later ("User setup" below). Build and test everything with a fake OAuth client,
  so no Google credentials are needed to finish this phase.

## Decisions
- **One site-wide connection.** There's one host and no accounts. The connection is a single row in the database.
  Connecting again replaces it, and disconnecting removes it.
- **Who can connect:** anyone who opens `/host`, because the host key is off on the demo (the user's decision). A
  reviewer can connect their own calendar to try the feature, and disconnecting falls back to the service account
  calendar. Say this in the UI copy ("Connecting replaces the site's calendar").
- **Scopes:** `https://www.googleapis.com/auth/calendar.freebusy` (busy times only, never event details) plus
  `openid email`, so the host page can show which account is connected. Use `access_type=offline` and
  `prompt=consent` so Google returns a refresh token.
- **Which calendar:** `primary` of the connected account.
- **Priority:** an OAuth connection wins over the service account env vars. With neither, the feature is off. Keep
  the Phase 6 `CalendarClient` interface: add an OAuth-backed client, and pick the active client per request through
  a small resolver, not a startup-time factory. Clear the 60 s busy cache on connect and disconnect.
- **Token storage:** store the refresh token **encrypted** (AES-256-GCM with `CALENDAR_TOKEN_KEY`, 32 bytes base64)
  in the database. Never log it and never return it. Access tokens stay in memory only.
- **OAuth flow through the same origin:** the redirect URI is `<frontend origin>/api/host/calendar/callback`. Vercel
  proxies `/api` to Render, so the browser never leaves the site's origin.
- **CSRF:** a random `state` stored in memory (one backend instance) with a 10-minute TTL and single use. The
  callback rejects unknown or expired states.
- **Broken connection:** if Google rejects the refresh token (revoked, expired), mark the connection `needsReconnect`,
  fail open (slots show as not busy), and show "Reconnect" on `/host`.
- **Host key:** when `HOST_KEY` is set, the connect route takes it as a `?hostKey=` query parameter, because a full
  page navigation can't send a header. It's off on the demo, so this is just for completeness.

## Schema
```prisma
model CalendarConnection {
  id                    String   @id @default("host") // single row
  email                 String
  refreshTokenEncrypted String   @map("refresh_token_encrypted")
  needsReconnect        Boolean  @default(false) @map("needs_reconnect")
  connectedAt           DateTime @default(now()) @map("connected_at") @db.Timestamptz
  @@map("calendar_connection")
}
```

## API (add to the API map in `README.md`)
| Method & path | Who | Response |
|---|---|---|
| `GET /api/host/calendar` | H | `{ connected: boolean, source: 'oauth' \| 'service_account' \| null, email: string \| null, needsReconnect: boolean, oauthAvailable: boolean }` |
| `GET /api/host/calendar/connect` | H (`?hostKey=`) | 302 to Google consent |
| `GET /api/host/calendar/callback` | — (`state` check) | 302 to `/host?calendar=connected` or `/host?calendar=error` |
| `DELETE /api/host/calendar` | H | 204 (revoke at Google best effort, delete the row) |

`oauthAvailable` is true when the four OAuth env vars are set. When it's false, the connect button is hidden. The
callback never shows Google's error text to the browser: it redirects with `calendar=error` and logs the reason
without tokens or codes.

## Env vars (all optional; OAuth is off unless all four are set)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`: `https://<vercel-domain>/api/host/calendar/callback` (and
  `http://localhost:3001/api/host/calendar/callback` locally)
- `CALENDAR_TOKEN_KEY`: from `openssl rand -base64 32`

## Tasks

### 7.1 Backend
- Write the migration for `calendar_connection`.
- `src/modules/calendar/`:
  - `token-crypto.ts` with `encrypt` and `decrypt`, using AES-256-GCM, a random IV, and output of
    `iv:tag:ciphertext` in base64;
  - `oauth-calendar.client.ts` implementing `CalendarClient` with `OAuth2Client` and the stored refresh token. On
    `invalid_grant` it sets `needsReconnect`;
  - `calendar-connection.service.ts` with `status`, `startConnect` (state and URL), `completeConnect(code, state)`
    (exchange the code, read the email from the id token, encrypt and upsert) and `disconnect`;
  - `calendar-client.resolver.ts` to pick OAuth, then the service account, then `null`.
- `HostCalendarController` holds the 4 routes. Rate limit connect, callback and disconnect with host-write limits.
- Inject the Google OAuth calls behind a token (`OAUTH_PROVIDER`), so tests use a fake.
- **Accept:** unit specs:
  - crypto round trip, plus a tampered ciphertext that fails;
  - the state store: single use, expiry, unknown state;
  - resolver priority;
  - `needsReconnect` on `invalid_grant`.
- **Accept:** e2e with the fake provider:
  - connect redirects with `state`;
  - the callback stores an encrypted row, and the token is never stored as plaintext (check the raw DB value);
  - status shows the email;
  - a busy fake marks slots Busy;
  - disconnect falls back to the service account or off;
  - a bad `state` redirects with `calendar=error`;
  - no OAuth env gives `oauthAvailable: false`.

### 7.2 Frontend (`/host`)
- Add a "Google Calendar" card above the slot list, on solid `bg-card` and following the design system:
  - **not connected:** a short explanation and a "Connect Google Calendar" pill, a full-page link to
    `/api/host/calendar/connect`;
  - **connected:** "Connected as name@gmail.com", a "Disconnect" button (through `ConfirmDialog`), and a note that
    connecting replaces the site's calendar;
  - **needs reconnect:** a warning tone and a "Reconnect" button;
  - **service account only:** "Using the site's default calendar", plus the connect button.
- On return, read `?calendar=connected|error` (`useSearchParams` inside `<Suspense>`), show a toast, and strip the
  parameter with `router.replace`.
- Replace the Phase 6 header pill with this card's state, and refresh config and slots after connect or disconnect.

### 7.3 Docs and config
- `render.yaml` and `backend/.env.example`: the 4 env vars (`sync: false`, empty).
- `docs/deploy.md`: a "Connect Google Calendar (OAuth)" section with the user setup below. Keep the service account
  section, marked as the fallback.
- `README.md`: API map, status row. Fill in these Handoff notes.

## User setup (goes into `docs/deploy.md`)
1. Google Cloud Console → the same project → **APIs & Services → OAuth consent screen**:
   - user type **External**;
   - app name "Slot", plus your email;
   - add the scope `.../auth/calendar.freebusy`;
   - add yourself (and any reviewer emails you know) as **Test users**.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - authorised redirect URIs: `https://<vercel-domain>/api/host/calendar/callback` and
     `http://localhost:3001/api/host/calendar/callback`.
   - Copy the client ID and secret.
3. Set the 4 env vars on Render (and in `backend/.env` locally), then redeploy.
4. While the consent screen is in **Testing**, only test users can connect. Anyone else gets "Access blocked". To
   let any reviewer try it, click **Publish app**. Google then shows an "unverified app" warning that they click
   through (Advanced → Go to Slot). That's fine for a demo of up to 100 accounts.

## Verification
```bash
cd backend && npm test && npm run test:e2e
cd ../frontend && npm run typecheck
```
Live check after the user's setup:
- on `/host`, connect, see "Connected as …";
- a slot overlapping a real event shows Busy on `/`;
- disconnect falls back.

## Commits
- `feat(calendar): store an encrypted google oauth connection for the host`
- `feat(calendar): add connect, callback, status and disconnect routes`
- `feat(host): add google calendar connect card`
- `docs: add google calendar oauth setup`

## Out of scope
Per-guest calendars, choosing a calendar other than `primary`, writing events, Google app verification.

## Handoff notes
- **Built (backend, `src/modules/calendar/`):** `token-crypto.ts` (AES-256-GCM, `iv:tag:ciphertext` base64, key =
  `CALENDAR_TOKEN_KEY`), `oauth-state.store.ts` (random single-use `state`, 10 min TTL, capped at 1000 pending),
  `oauth.provider.ts` (`OAUTH_PROVIDER` token, `OAuthProvider` type, `GoogleOAuthProvider` = the only code that calls
  Google: `generateAuthUrl`, `getToken`, `verifyIdToken` for the email, `getAccessToken`, `revokeToken`;
  `InvalidGrantError`), `oauth-calendar.client.ts` (`CalendarClient` for `primary`, in-memory access token, calls
  `onInvalidGrant`), `calendar-client.resolver.ts` (per request: OAuth row, else service account, else none),
  `calendar-connection.service.ts`, `host-calendar.controller.ts` (4 routes), shared `fetchFreeBusy` in
  `google-calendar.client.ts`. Table `calendar_connection` (migration `calendar_connection`).
- **Behaviour:** `CalendarBusyService` now asks the resolver on every call (`isConnected()` is async; `/api/config`
  `calendarConnected` is true when a usable client exists). Connect/disconnect/reconnect clear the 60 s busy cache and
  the cached OAuth client. A row with `needsReconnect` (set on `invalid_grant`, or if the token can't be decrypted)
  resolves to no client and does not fall back to the service account, so slots show as not busy and `/host` shows
  Reconnect. The callback never throws: bad or reused `state`, Google's `error` param, a failed exchange, or no
  refresh token all redirect to the fixed path `/host?calendar=error` (Google's text is never read or echoed).
  Connect with OAuth unset also redirects to `/host?calendar=error`. `oauthAvailable` needs the three Google vars
  **and** a valid 32-byte `CALENDAR_TOKEN_KEY`. `HostKeyQueryGuard` (connect only) reads `?hostKey=`; status and
  disconnect use the header guard. Rate limit: host-write (30/min) on connect, callback and disconnect.
- **Security:** tokens, codes, the secret and the key are never logged or returned (only error class names are
  logged). The e2e checks the raw DB column is not the plaintext and decrypts back to it.
- **Frontend:** `features/calendar/{api,hooks}.ts`, `components/calendar-card.tsx` (not connected, connected,
  needs reconnect, service account only, OAuth unavailable; Disconnect through `ConfirmDialog`; plain `<a>` to
  `/api/host/calendar/connect`, with `?hostKey=` when a key is stored), `calendar-return-toast.tsx`
  (`useSearchParams` in `<Suspense>`, toast, `router.replace`). The Phase 6 header pill is gone. After connect or
  disconnect the `calendar`, `config`, `slots` and `host-slots` queries are invalidated. The card is hidden if the
  status request fails.
- **Tests:** unit specs for crypto (round trip, tampering), state store, resolver priority, `needsReconnect` on
  `invalid_grant`, cache clearing; `test/calendar-oauth.e2e-spec.ts` with a fake `OAUTH_PROVIDER` and a stubbed
  `fetch` that refuses any non-freeBusy URL. No test touches Google.
- **Unverified:** the live OAuth flow (consent URL, code exchange, id token email, refresh, revoke, freeBusy with a
  user token) and the new card in a browser. Needs the user's OAuth client; follow "Connect Google Calendar (OAuth)"
  in `docs/deploy.md`.
- **Known limits:** `state` lives in memory (one backend instance; a Render restart mid-consent gives
  `calendar=error`, just retry). Revoking a replaced connection's old token is not attempted. The relative redirect
  `/host?...` relies on the Vercel/Next proxy passing the 302 through unchanged.
