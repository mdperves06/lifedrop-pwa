# LifeDrop — Blood Donation Management System

LifeDrop is an installable, mobile-first **Progressive Web App** for coordinating voluntary blood donation in a single city (default: Dhaka). It combines public education with day-to-day operations:

- **The public** can learn about donation, check eligibility, find centers and see live stock levels.
- **Donors** can register, set their availability, book appointments, respond to requests and download donation certificates.
- **Requesters, including hospitals,** can post normal, urgent or emergency requests. Emergency and urgent requests automatically alert compatible donors nearby.
- **Donation-center staff** can check donors in, record donations and manage blood stock.
- **Admins** can moderate users and reports, manage centers, locations and campaigns, send announcements and read analytics.

> LifeDrop connects voluntary donors with people who need blood. It does **not** make medical decisions. Final compatibility and eligibility are always decided by qualified staff at a blood bank or hospital.

---

## Features

| Area | What's included |
| --- | --- |
| Public awareness | Hero with CTAs, impact counter, facts, myths vs facts, benefits, **compatibility chart**, step-by-step guide, FAQ, **eligibility checker** |
| Auth & profiles | Sign up (3-step), sign in with email **or** phone, logout, forgot/reset password, email verification link, **phone OTP** (pluggable SMS), role-based access (Donor · Center staff · Hospital · Admin), avatar upload, account deletion |
| Donor availability | Available / temporarily unavailable / not available, emergency availability, last donation, next available date, one-tap toggle |
| Donor search | Blood group (optionally "include compatible"), Division → District → Area, available now, emergency, recently active. Paginated and privacy-safe |
| Blood requests | Normal / Urgent / Emergency, drafts, duplicate guard, full lifecycle (Draft → Open → Matching → Donors contacted → Donor accepted → Fulfilled → Closed, plus Cancelled / Expired), timeline, auto-expiry, reopen |
| Matching | Deterministic and explainable: compatible group, available, verified, past the donation interval, same area or district, **radius alerts (default 5 km)** with district fallback |
| Donor response | Accept / Decline in the app **and from push-notification action buttons**. Contact details are revealed only after acceptance and only as far as the donor's privacy settings allow. Extra donors are released automatically once enough have accepted |
| Centers | List, map (OpenStreetMap; Google Maps embed optional), "find nearest" using browser geolocation, details (capacity, staff, beds, equipment, groups needed), live status (open / closed / full), reviews from verified donors |
| Appointments | 21-day calendar with hourly morning (8 am–1 pm) and evening (2–6 pm) slots, capacity per slot, automatic eligibility check, reminders **24 h and 1 h** before (push, SMS, email), cancel, reschedule, walk-in |
| Inventory | Stock by group with green / amber / red levels, expiry tracking (FEFO issue), "expiring soon" warnings, low-stock alerts to admins, daily target vs actual, 30-day history chart, issue units against a request |
| Donor dashboard | History, next eligible date, private Bronze / Silver / Gold badges, **PDF certificate**, impact ("units issued to patients"), referral link |
| Hospital portal | Emergency CTA, live-updating active requests, response counts, city stock |
| Center portal | Today's appointments, check-in, record donation, no-show, walk-in registration, status override, groups needed, stock adjustments, batch list, mark expired |
| Admin | Metrics, analytics (trends, demographics, demand), users (role/status, verify), requests, reports (warn / suspend / remove / resolve), inventory, appointments, campaigns, centers, locations, announcements, audit log, settings |
| Notifications | In-app notification centre, unread badge, **Web Push** (VAPID), SMS and email channels, emergency alerts |
| PWA | Manifest, maskable icons, service worker, offline fallback, public pages cached for offline use, a snoozable install banner (with iOS hint), update prompt, push support, app shortcuts |
| UX | Mobile-first, bottom tab bar and slide-out menu, dark / light / system theme, **English / বাংলা**, loading, empty, error and success states everywhere, duplicate-submit protection, accessible (labels, focus rings, skip link, ARIA radios and switches, reduced motion) |

## Tech stack

- **Next.js 16** (App Router, React 19, Turbopack) with **TypeScript**
- **Tailwind CSS 4**. No component library; a small design system lives in `src/components/ui.tsx`
- **Prisma 6**. **SQLite** for zero-install development, **PostgreSQL** for production
- **jose** (JWT, HS256), **bcryptjs** (cost 12), **zod** (validation shared by client and server)
- **web-push** (VAPID), **nodemailer** (SMTP), pluggable SMS provider (console / Twilio)
- **Leaflet + OpenStreetMap** for maps (no API key needed), **pdf-lib** for certificates
- **Vitest** for unit and integration tests, plus `scripts/smoke.mjs` for end-to-end API tests

## Quick start

```bash
npm install
cp .env.example .env        # then set JWT_SECRET (see SETUP.md)
npm run setup               # create the SQLite schema and load demo data
npm run dev                 # http://localhost:3000
```

**Demo accounts** (development only) are listed at the top of [`prisma/seed.ts`](prisma/seed.ts), and there is a "Demo accounts" helper on the sign-in page. The demo data is fictional: every demo user has `isDemo=true` and an `@lifedrop.test` email.

See **[SETUP.md](SETUP.md)** for full setup, including the database, VAPID keys, SMTP and SMS.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest suite (creates a throwaway `prisma/test.db`) |
| `node scripts/smoke.mjs [url]` | End-to-end API journey test against a running, seeded server |
| `node scripts/crawl.mjs [email] [url]` | Loads every page as a demo user and reports errors |
| `npm run db:push` · `npm run db:seed` · `npm run setup` | Apply the schema · load demo data · both |
| `npm run vapid` | Generate Web Push keys |
| `npm run icons` | Regenerate the PWA icons from SVG |

## Environment variables

Every variable is documented in [`.env.example`](.env.example). Summary:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | `file:./dev.db` (SQLite) or a PostgreSQL URL |
| `JWT_SECRET` | ✔ in prod | At least 32 random characters. The app refuses to start in production without it |
| `APP_URL` | ✔ in prod | Public origin, used for email links and the CSRF origin allow-list |
| `CRON_SECRET` | ✔ if using external cron | Bearer token for `/api/cron/run` |
| `RUN_JOBS_IN_PROCESS` |  | `true` (default) runs reminders and expiry every 5 minutes inside the server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push | `npm run vapid` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | for email | Empty host means emails are logged to the console |
| `SMS_PROVIDER`, `TWILIO_*` | for SMS | `console` (default) or `twilio` |
| `UPLOAD_DIR` |  | Avatar storage directory |
| `NEXT_PUBLIC_TZ`, `NEXT_PUBLIC_TZ_OFFSET_MINUTES` |  | City timezone (default Asia/Dhaka, +360) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |  | Optional Google Maps embed on center pages |
| `EXPOSE_DEV_SECRETS` |  | Dev only: API responses include verification links and OTPs |

## Database setup

Development uses SQLite, so there is nothing to install. For production, switch the Prisma provider to PostgreSQL. [DATABASE.md](DATABASE.md) covers the steps, the entity model and the indexes.

## Production deployment

1. Provision PostgreSQL and set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Set all the required environment variables: `JWT_SECRET`, `APP_URL`, `DATABASE_URL`, VAPID, SMTP and SMS.
3. `npm ci && npx prisma migrate deploy` (or `prisma db push` for a first deploy), then `npm run build && npm start`.
4. **Scheduler.** On a single long-running server, leave `RUN_JOBS_IN_PROCESS=true`. On serverless hosts (for example Vercel), set it to `false` and call `GET /api/cron/run` every 5 minutes with `Authorization: Bearer $CRON_SECRET`.
5. Serve over **HTTPS**. It is required for service workers, push and geolocation, and the session cookie is `Secure` in production.
6. For multiple instances, move rate limiting to Redis and avatars to object storage. [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md) explain both.

## PWA installation

- **Android / Chrome / Edge:** after a few seconds an "Install LifeDrop" banner appears (it can be dismissed and stays hidden for 30 days). The browser's own "Install app" menu item also works.
- **iOS Safari:** tap **Share → Add to Home Screen**. The banner shows this hint.
- **Desktop Chrome / Edge:** use the install icon in the address bar.
- To get push notifications, enable them on the **Notifications** or **Profile** page. On iOS they need iOS 16.4 or later and an installed app.

The service worker registers in **production builds only**, so it never caches stale code during development.

## Testing

```bash
npm test                               # 46 unit + integration tests (Vitest, SQLite test DB)
npm run dev & node scripts/smoke.mjs   # 51 end-to-end checks across donor, requester, staff and admin journeys
```

What's covered: authentication (hashing, JWT tamper-resistance, login, reset, verification), authorization (role checks, admin guards, staff scoped to their center), blood-group validation and compatibility, donor search and location filtering, availability filtering, matching and radius alerts, request creation, duplicates and limits, acceptance, decline, cancellation, expiry, notification creation, appointments (capacity, eligibility, reminders), inventory (FEFO, over-issue, expiry alerts), donation recording, account deletion, CSRF origin blocking and redirect safety.

## Documentation

- [SETUP.md](SETUP.md): step-by-step setup
- [ARCHITECTURE.md](ARCHITECTURE.md): structure, request flow, matching, notifications, PWA
- [DATABASE.md](DATABASE.md): entities, enums, indexes, switching to PostgreSQL
- [API.md](API.md): every endpoint
- [SECURITY.md](SECURITY.md): threat model and controls
- [TODO.md](TODO.md): known limitations and roadmap
