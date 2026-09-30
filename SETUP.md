# Setup

## Requirements

- Node.js **20.9+** (developed on Node 24)
- npm 10+
- For production: PostgreSQL 14+ and an HTTPS host

## 1. Install

```bash
npm install
```

npm 11 blocks dependency install scripts by default. The ones this project needs (Prisma engines, esbuild, sharp) are allow-listed in `package.json` → `allowScripts`. If `prisma generate` complains about a missing engine, run `npx prisma generate`.

## 2. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env`:

- **JWT_SECRET**: generate one with
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- **Web Push (optional, recommended)**:
  ```bash
  npm run vapid
  ```
  Paste the two printed lines into `.env`.
- **Email (optional)**: set `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM`. While `SMTP_HOST` is empty, emails (verification, reset, reminders) are printed to the server console.
- **SMS (optional)**: `SMS_PROVIDER=twilio` plus the `TWILIO_*` values. The default `console` provider prints OTPs and alerts to the server log.

In development, `EXPOSE_DEV_SECRETS=true` makes the API return verification links and OTP codes, so you can test those flows without real email or SMS. This is always disabled in production.

## 3. Database

SQLite is used for development, so there is nothing to install:

```bash
npm run setup        # = prisma db push + demo seed
```

To reload the demo data later, run `npm run db:seed`. The seed wipes and recreates **all** data in the dev database.

For PostgreSQL, see [DATABASE.md](DATABASE.md#switching-to-postgresql).

## 4. Run

```bash
npm run dev          # http://localhost:3000
```

Sign in with a demo account (see the header of `prisma/seed.ts`, or the "Demo accounts" helper on `/login`):

| Account | What to try |
| --- | --- |
| Donor | Dashboard, toggle availability, respond on `/incoming`, book on `/appointments/new`, download a certificate |
| Requester | `/requests/new?priority=EMERGENCY`, watch responses on the request page, mark it fulfilled |
| Hospital | `/hospital` portal, live updates |
| Center staff | `/center`: check in, record a donation, adjust stock, mark expired |
| Admin | `/admin`: everything, including reports, audit log and settings |

## 5. Verify

```bash
npm run lint
npm run typecheck
npm test
node scripts/smoke.mjs          # needs the dev server running on :3000 with seed data
node scripts/crawl.mjs          # every page as admin
```

## 6. Production build locally

```bash
npm run build
npm start                       # http://localhost:3000
```

The service worker and install banner only activate in production builds. `localhost` counts as a secure context, so you can test installability and push there.

## Troubleshooting

- **`EPERM ... query_engine-windows.dll.node`** during `npm run build` on Windows: a running dev server has the Prisma engine locked. Stop it, or run `npx next build` (the client is already generated).
- **Push toggle disabled**: VAPID keys are missing, the browser blocked notifications, or you are on a dev build (the service worker isn't registered in dev).
- **"Too many attempts"**: rate limits are in memory. Restarting the dev server resets them.
