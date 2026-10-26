# Deploy checklist

Neon (database) -> Render (API) -> Vercel (web) -> seed -> `FRONTEND_ORIGIN`. Never commit any value below.

## 0. GitHub
Push the repo (public) to GitHub. Render and Vercel both import it from there.

## 1. Neon
1. neon.tech -> **New project** (Postgres 16, region close to your Render region).
2. **Connect** -> turn **Connection pooling** ON -> copy the string. That is `DATABASE_URL`.
3. Turn pooling OFF -> copy the string. That is `MIGRATE_DATABASE_URL`.
4. Both must end with `?sslmode=require`. If they contain `&channel_binding=require`, delete that part.

## 2. Render (API)
1. dashboard.render.com -> **New** -> **Blueprint** -> pick the repo (it reads `render.yaml`). Set the service
   region the same as Neon's if you can.
2. Fill the prompted env vars (see table). `TRUST_PROXY`, `APP_TIME_ZONE`, `RATE_LIMIT_ENABLED` are prefilled.
3. **Apply**. The build runs `prisma generate`, `prisma migrate deploy` and `nest build`; wait for **Live**.
4. Open `https://<service>.onrender.com/api/health`. Expect `{"status":"ok"}` (first hit may take 30 to 50 s).

Manual alternative to the blueprint: **New** -> **Web Service**, root directory `backend`, runtime Node, plan Free,
build command and start command as in `render.yaml`, health check path `/api/health`.

## 3. Vercel (web)
1. vercel.com -> **Add New** -> **Project** -> import the repo.
2. **Root Directory**: `frontend`. Framework preset: Next.js (auto).
3. **Environment Variables**: `BACKEND_URL` = `https://<service>.onrender.com` (no trailing slash, no `/api`).
4. **Deploy**. Note the production URL, `https://<project>.vercel.app`.

## 4. Update `FRONTEND_ORIGIN`
Render -> service -> **Environment** -> set `FRONTEND_ORIGIN` = the Vercel URL (no trailing slash) -> **Save**
(it redeploys). The browser only talks to Vercel, so this matters for direct API calls only.

## 5. Seed the demo data
On your machine, from `backend/`, with the Neon **direct** URL:
```bash
DATABASE_URL='<MIGRATE_DATABASE_URL value>' npm run seed
```
It creates 10 half-hour slots over the next 5 weekdays and one demo booking (Ana Petrova). Safe to re-run. Check the
`DATABASE_URL` shell variable does not already point at a local database.

## 6. Smoke test (phase 4.2 accept)
On desktop and phone: create a slot on `/host`, see it on `/`, book it, see the confirmation; in a second browser
it shows as Booked; `curl -XPOST https://<vercel>/api/slots/<id>/bookings ...` on it returns 409.

## Env vars

| Where | Name | Value comes from |
|---|---|---|
| Render | `DATABASE_URL` | Neon, pooled connection string |
| Render | `MIGRATE_DATABASE_URL` | Neon, direct (non-pooled) connection string |
| Render | `FRONTEND_ORIGIN` | Vercel production URL |
| Render | `TRUST_PROXY` | prefilled by blueprint (`1`) |
| Render | `APP_TIME_ZONE` | prefilled by blueprint (`Europe/Skopje`) |
| Render | `RATE_LIMIT_ENABLED` | prefilled by blueprint (`true`) |
| Render | `HOST_NAME` | optional, your name for the UI |
| Render | `GEMINI_API_KEY` | optional, Google AI Studio; without it the template message is used |
| Render | `GEMINI_MODEL` | optional, a free-tier Flash model name from AI Studio (default `gemini-flash-latest`) |
| Render | `GOOGLE_CALENDAR_ID` | optional, your calendar's ID (see "Google Calendar with a service account" below) |
| Render | `GOOGLE_SERVICE_ACCOUNT_JSON` | optional, `base64 -w0 key.json` of the service account key |
| Render | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | optional, OAuth client (see "Connect Google Calendar (OAuth)" below) |
| Render | `GOOGLE_OAUTH_REDIRECT_URI` | optional, `https://<vercel-domain>/api/host/calendar/callback` |
| Render | `CALENDAR_TOKEN_KEY` | optional, `openssl rand -base64 32` |
| Render | `HOST_KEY` | leave **unset** (host page open on the demo) |
| Vercel | `BACKEND_URL` | Render service URL |

## Notes
- Free Render instances sleep after about 15 minutes idle. The first request takes 30 to 50 s; the UI shows its
  skeleton and retries for about a minute.
- To switch the host key on later, set `HOST_KEY` on Render and enter it on `/host`.

## Connect Google Calendar (OAuth, optional)
The host clicks **Connect Google Calendar** on `/host`, signs in with Google, and from then on slots that clash with
that account's primary calendar show as "Busy". Only free/busy times are read (scope `calendar.freebusy`), never event
details. There is one site-wide connection; connecting again replaces it and **Disconnect** removes it. It wins over
the service account below, which stays as the fallback. The refresh token is stored encrypted (AES-256-GCM).

1. Google Cloud Console, in the same project: **APIs & Services > OAuth consent screen**.
   - User type **External**, app name "Slot", plus your email.
   - Add the scope `.../auth/calendar.freebusy`.
   - Add yourself (and any reviewer emails you know) as **Test users**.
2. **Credentials > Create credentials > OAuth client ID > Web application**.
   - Authorised redirect URIs: `https://<vercel-domain>/api/host/calendar/callback` and
     `http://localhost:3001/api/host/calendar/callback`.
   - Copy the client ID and secret.
3. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` and `CALENDAR_TOKEN_KEY`
   (`openssl rand -base64 32`) on Render, and in `backend/.env` locally, then redeploy. The button only appears when
   all four are set. Locally, open the app on http://localhost:3001 so the redirect URI matches.
4. While the consent screen is in **Testing**, only test users can connect; anyone else gets "Access blocked". To let
   any reviewer try it, click **Publish app**. Google then shows an "unverified app" warning that they click through
   (Advanced > Go to Slot). That is fine for a demo of up to 100 accounts.
5. Check: on `/host` click Connect, accept the consent screen and see "Connected as ...". A slot that overlaps a real
   event shows "Busy" on `/`. Disconnect falls back to the service account, or turns the check off.

If Google rejects the stored token (revoked or expired), `/host` shows "Reconnect" and slots show as not busy until
you do. Anyone who opens `/host` can connect their own calendar while no `HOST_KEY` is set (the demo setup).

## Google Calendar with a service account (optional, fallback)
Slots that clash with an event in your Google Calendar show as "Busy" to guests and cannot be booked. Only
free/busy times are read, never event titles. Without the two variables the feature is off and everything else works.

1. Go to https://console.cloud.google.com, create a project, then **APIs & Services > Enable APIs** and enable
   **Google Calendar API**.
2. **IAM & Admin > Service Accounts > Create** (no roles needed). Open it, then **Keys > Add key > JSON**. This
   downloads the key file.
3. In Google Calendar (web) go to **Settings > your calendar > Share with specific people** and add the service
   account's email with **See only free/busy**.
4. Set `GOOGLE_CALENDAR_ID` (your calendar's ID from "Integrate calendar", usually your Gmail address) and
   `GOOGLE_SERVICE_ACCOUNT_JSON` (`base64 -w0 key.json`) in `backend/.env` locally and on Render.
5. Check: create a slot that overlaps a real event, open `/` and look for "Busy". The Google Calendar card on `/host`
   reads "Using the site's default calendar".

If Google is slow (over 3 seconds) or unreachable, slots show as normal and booking still works.
