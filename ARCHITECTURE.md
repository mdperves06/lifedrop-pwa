# Architecture

## Overview

A single Next.js 16 application. Pages are **React Server Components** that read data through a service layer. Mutations go through JSON **route handlers** under `/api`, which are also the public API. All business rules live in `src/server/services`, so they can be tested without HTTP.

```
Browser (PWA) ── RSC pages ──► services ──► Prisma ──► SQLite / PostgreSQL
      │                          ▲
      └── fetch /api/* ──► handler() ─┘   (auth · CSRF · zod · rate limit · errors)
      ▲
Service worker: offline shell · push display · Accept/Decline actions → /api
```

## Directory layout

```
prisma/            schema.prisma, seed.ts (demo data), data/locations.ts
public/            sw.js (service worker), icons/
scripts/           smoke.mjs, crawl.mjs, generate-icons.mjs, generate-vapid.mjs
src/
  app/             routes (pages + /api route handlers)
    (auth)/        login, register, forgot/reset password, verify
    admin/         admin area (layout guard + per-page guard)
    api/           REST-ish JSON API (see API.md)
  components/
    ui.tsx         design system (buttons, cards, badges, icons…)
    blocks.tsx     server-rendered blocks (stock grid, request card, charts, compatibility)
    client/        interactive pieces (shell/nav, fields, map, toasts, PWA, push, report)
  i18n/            en.ts, bn.ts dictionaries, server/client helpers
  lib/             shared pure logic: blood, eligibility, lifecycle, validation (zod), time, geo
  server/
    auth/          session.ts (JWT + bcrypt + DB check), guard.ts (page guard)
    notify/        index.ts (in-app + fan-out), channels.ts (push, email, SMS providers)
    services/      auth, donors, matching, requests, request-views, appointments,
                   centers, inventory, stats, admin, locations
    http.ts        handler(), ApiError, CSRF origin check, rate limiter
    settings.ts    runtime settings (DB-backed, admin-editable)
    jobs.ts        reminders, request expiry, batch expiry
  proxy.ts         optimistic auth redirect + noindex headers (Next 16 "proxy" = middleware)
  instrumentation.ts  in-process scheduler (every 5 minutes)
tests/             Vitest suites + fixtures
```

## Request handling

`handler()` in `src/server/http.ts` wraps every route:

1. **CSRF**: every state-changing method must carry an `Origin` (or `Referer`) whose host matches the request host or `APP_URL`.
2. **Rate limit** (optional per route), keyed by client IP.
3. **Params**: awaits the Next 16 async `params`.
4. **Errors**: `ApiError` → `{ error: { code, message, details } }` with the right status. `ZodError` → 422 with per-field messages. Prisma P2002 → 409, P2025 → 404. Anything else → 500 with a generic message (the detail is logged server-side).

Responses always look like `{ data }` or `{ error }`. The client helper `api()` (`src/lib/api-client.ts`) never throws, and `useAction()` adds loading state, duplicate-submit protection, toasts and `router.refresh()`.

## Authentication & authorization

- A **stateless JWT** (HS256, 7 days) is stored in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie called `ld_session`.
- `getSessionUser()` verifies the JWT, **then re-checks the database**: the user must exist, be `ACTIVE`, and have a matching `tokenVersion`. Bumping `tokenVersion` revokes all sessions (password reset, role change, suspension, account deletion).
- `requireUser()` / `requireRole()` are used in every API route. `requirePageUser()` is used in every private page, including every admin page (layouts are not re-run on client navigation).
- `proxy.ts` only does an optimistic cookie-presence redirect for private paths. It is not a security boundary.
- Roles: `DONOR` (default; can also make requests), `CENTER_STAFF` (scoped to `centerId`), `HOSPITAL` (scoped to `hospitalId`), `ADMIN`. Roles can only change through `/api/admin/users/:id`.
- Adding **SMS OTP login** later means a new provider in `notify/channels.ts` plus a `PHONE_OTP` login route. Tokens and OTP verification already exist (`VerificationToken` with the `PHONE_OTP` type).

## Matching engine (`services/matching.ts`)

The matching is deterministic and explainable. It **only suggests volunteers**; it never makes a medical decision.

1. **Eligible pool:** `availability=AVAILABLE`, `showInSearch`, an active and verified account, past the donation interval (`lastDonationDate + donationIntervalDays`), past `nextAvailableDate`, and `emergencyAvailable` when the request is an emergency.
2. **Blood group:** `compatibleDonorGroups(recipient)` (red-cell compatibility table in `lib/blood.ts`).
3. **Location:** areas in the request's district, plus any area whose centroid lies within the radius. Donor locations are **area-level centroids**, never GPS.
4. **Score:** same area +40, same district +20, distance bonus (up to +20), exact group +15 (keeps universal O− donors for when they're truly needed), active in the last 7 or 30 days +10 or +5, emergency-available +5.
5. **Radius mode** (urgent and emergency auto-alerts): only donors within `emergencyRadiusKm` (default 5). If nobody qualifies, it falls back to the whole district and the request is marked as expanded.

## Request lifecycle (`lib/lifecycle.ts`, `services/requests.ts`)

```
DRAFT → OPEN → MATCHING → DONOR_CONTACTED → DONOR_ACCEPTED → FULFILLED → CLOSED
          └────────── CANCELLED / EXPIRED (from any active state); EXPIRED → OPEN (reopen)
```

Every change goes through `setStatus()`, which validates it with `canTransition()` and writes a `RequestStatusEvent` (the timeline). Edge cases handled:

- **All contacted donors decline:** the request goes back to `MATCHING`.
- **More donors accept than units needed:** once `accepted ≥ units`, the remaining pending invites are cancelled and those donors are told "no longer needed".
- **Cancel, fulfil or expire:** pending and accepted donors are released and notified.
- **Duplicates:** the same requester, group and hospital cannot have another active request within 12 hours (409 with a link to the existing one).
- **Unverified requesters:** limited to `maxOpenRequestsUnverified` active requests.
- **Expiry:** `neededAt + requestExpiryHours` → `EXPIRED`. Fulfilled requests auto-close after 7 days.
- **Account deletion:** personal data is anonymised, the user's requests are cancelled, pending invites withdrawn and push subscriptions removed.

## Notifications (`server/notify`)

`notify(items, { push, sms, email, urgent })` always writes `Notification` rows first (the source of truth for the in-app centre), then fans out:

- **Web Push** via VAPID. Expired subscriptions (404/410) are pruned. Donation requests include `donationRequestId`, so the service worker shows **Accept / Decline** buttons that POST straight to `/api/donation-requests/:id/respond`.
- **SMS** through the `SmsProvider` interface (console / Twilio; add others without touching business code).
- **Email** via nodemailer, or the console when SMTP isn't configured.

Channel failures never fail the operation. **Near-real-time UI:** the unread badge polls every 20 s (visible tabs only), and request, hospital and board pages re-render every 15–30 s via `router.refresh()`. They also refresh immediately when the service worker receives a push. Polling keeps the system host-agnostic (works on serverless); SSE or WebSockets could replace it later.

## Scheduling (`server/jobs.ts`)

Every 5 minutes: appointment reminders (24 h and 1 h, each idempotent through `reminder*SentAt`), auto no-show after 3 h, request expiry, and batch expiry with low-stock alerts. The scheduler runs **in-process** from `instrumentation.ts` by default. For serverless, disable it and call `/api/cron/run` with the cron secret.

## Inventory

- Stock is a set of `InventoryBatch` rows (units, collected, expires, status). Levels = the sum of `AVAILABLE` units that haven't expired yet.
- Issue and discard consume batches **first-expiring-first-out**, splitting partial batches.
- Every movement writes an `InventoryLog`, which feeds the 30-day history chart (reconstructed backwards from current stock).
- Thresholds (`lowStockUnits`, `criticalStockUnits`) are city-wide and scaled down per center. Crossing into LOW or CRITICAL notifies admins. This includes stock that falls because batches expire.
- Recording a donation creates a `Donation` (with a certificate number), adds a 1-unit batch (unless it's a directed donation for a request), updates the donor's last donation date and completes the appointment.

## i18n

`src/i18n/en.ts` is the source dictionary. `bn.ts` is type-checked against its shape. The locale comes from the `ld_locale` cookie, then `Accept-Language`. The server layout passes **only the active dictionary** to the client provider. Dates and numbers use `Intl` with `bn-BD`.

## PWA

- `app/manifest.ts` defines standalone display, theme colours, any and maskable icons, and shortcuts (Emergency, Find, Book).
- `public/sw.js`:
  - `/_next/static` and icons are cache-first.
  - Navigations are network-first. Only **public** pages are cached for offline use (private pages are never stored), with `/offline` as the fallback.
  - `/api` is never cached.
  - Private caches are cleared on account deletion.
- `PwaManager` registers the service worker (production only) and shows one install banner, snoozed for 30 days after dismissal, with an iOS "Add to Home Screen" hint and an update-available prompt.

## Extensibility (future-ready)

- **Hospitals, blood banks, NGOs:** `Hospital` and `Center` are first-class entities, so new roles plug into `Role` and `requireRole`.
- **Verified donors, SMS OTP login, WhatsApp or Telegram:** add a provider to `notify/channels.ts`.
- **Distance-based search or maps:** area centroids already exist, and matching exposes `distanceKm`.
- **Certificates and analytics** already exist. Campaigns link to appointments.
- **Storage:** `server/storage.ts` has three functions to swap for S3 or R2.
- **Rate limiting:** replace the `Map` in `server/http.ts` with Redis.
