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
| Render | `HOST_KEY` | leave **unset** (host page open on the demo) |
| Vercel | `BACKEND_URL` | Render service URL |

## Notes
- Free Render instances sleep after about 15 minutes idle. The first request takes 30 to 50 s; the UI shows its
  skeleton and retries for about a minute.
- To switch the host key on later, set `HOST_KEY` on Render and enter it on `/host`.
