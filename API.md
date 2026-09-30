# API

Base path: `/api`. Responses are JSON:

- **Success:** `{ "data": … }`
- **Failure:** `{ "error": { "code": "…", "message": "…", "details": … } }`

**Authentication** uses the `ld_session` httpOnly cookie, which is set by login and register.

**CSRF:** every `POST` / `PATCH` / `DELETE` must send an `Origin` (or `Referer`) header from the same host. Browsers do this automatically.

**Validation errors** return `422` with `details` mapping each field to its message.

| Status | Meaning |
| --- | --- |
| 400 | Bad JSON / invalid token |
| 401 | Not signed in |
| 403 | Forbidden / bad origin / suspended |
| 404 | Not found |
| 409 | Conflict / duplicate / invalid transition |
| 413 / 415 | Upload too large / unsupported type |
| 422 | Validation failed |
| 429 | Rate limited (`details.retryAfterSec`) |
| 503 | Feature not configured (push) |

Legend for the Auth column: — public · 👤 any signed-in user · 🏥 hospital · 🧑‍⚕️ center staff · 🛡 admin

## Auth

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | `name, email, phone, password, bloodGroup, locationId (area), dateOfBirth, gender?, weightKg, lastDonationDate?, healthDeclarationOk, wantsToDonate?, referralCode?, acceptTerms: true, locale?` → sets cookie. Role is always DONOR. Limit: 5/h/IP |
| POST | `/auth/login` | — | `identifier` (email or phone), `password` → `{ redirect }`. Limits: 10/15 min per account, 50/15 min per IP |
| POST | `/auth/logout` | — | Clears cookie. Form posts get a 303 redirect to `/` |
| POST | `/auth/forgot` | — | `email` → always `{ sent: true }` (no account enumeration) |
| POST | `/auth/reset` | — | `token, password`. Single use, 1 h, revokes all sessions |
| POST | `/auth/verify-email` | — | `token` (48 h, single use) |
| POST | `/auth/resend-verification` | 👤 | Limit 3/15 min |
| POST | `/auth/phone-otp` | 👤 | Sends a 6-digit OTP by SMS (10 min). Limit 3/10 min |
| POST | `/auth/verify-phone` | 👤 | `code`. Max 5 attempts per code |

## Me

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/me` | 👤 | Own profile + donor profile |
| PATCH | `/me` | 👤 | `name, phone, locationId, organization, note, dateOfBirth, gender, locale`. Changing the phone resets phone verification |
| DELETE | `/me` | 👤 | Anonymise and delete the account (the last admin cannot) |
| PATCH | `/me/donor` | 👤 | `bloodGroup, weightKg, availability, emergencyAvailable, lastDonationDate, nextAvailableDate, healthDeclarationOk, sharePhoneAfterAccept, shareEmailAfterAccept, showInSearch` |
| POST | `/me/locale` | — | `locale: "en" \| "bn"`. Sets the cookie and saves it to the profile if signed in |
| POST / DELETE | `/me/avatar` | 👤 | multipart `file` (PNG / JPEG / WebP, ≤ 1 MB, checked by magic bytes) |
| GET | `/avatars/:file` | — | Serves the uploaded avatar |

## Directory & search

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/locations` | — | Flat list `{ id, name, nameBn, type, parentId }` |
| GET | `/donors` | — | Query: `bloodGroup, compatible=1, divisionId \| districtId \| areaId, availableNow=0\|1 (default 1), emergency=1, recentlyActive=1, page`. Returns public cards only (no phone, email or coordinates; anonymous viewers see "First L."). Limit 60/min |

## Blood requests

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/requests` | — | Public board of active requests (no patient names or contacts) |
| POST | `/requests` | 👤 | `bloodGroup, units, patientName, hospitalName, hospitalAddress?, hospitalId?, locationId (area), neededAt, priority, notes?, contactPreference, contactPhone?, saveAsDraft?` → `{ id, status, autoNotified }`. URGENT and EMERGENCY auto-alert nearby donors. 409 `DUPLICATE_REQUEST` returns `details.requestId`. Limit 10/h |
| POST | `/requests/:id/action` | owner / hospital / 🛡 | `action: PUBLISH \| CANCEL \| FULFILL \| CLOSE \| REOPEN`, `note?`, `unitsFulfilled?`. Invalid transitions return 409 `BAD_TRANSITION` |
| GET | `/requests/:id/matches` | owner / hospital / 🛡 | Ranked compatible donors not yet contacted |
| POST | `/requests/:id/donors` | owner / hospital / 🛡 | `donorIds[] (≤20), message?` → `{ sent, skipped }`. Only compatible donors who are past their interval |
| POST | `/donation-requests/:id/respond` | invited donor | `action: ACCEPT \| DECLINE`. Idempotent. Also used by push-notification buttons |

## Notifications & push

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/notifications?cursor=` | 👤 | 30 per page, newest first |
| GET | `/notifications/unread` | — | `{ unread }` (0 when signed out) |
| POST | `/notifications/read` | 👤 | `{ ids: [] }` or `{ all: true }` |
| POST / DELETE | `/push/subscribe` | 👤 | A `PushSubscription` JSON / `{ endpoint }` |

## Centers & appointments

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/centers` | — | Centers with live status, rating and needed groups |
| PATCH | `/centers/:id` | 🧑‍⚕️ own center / 🛡 | `statusOverride`, `neededBloodGroups[]` |
| GET | `/centers/:id/slots?from=YYYY-MM-DD&days=` | — | Hourly slots with remaining capacity |
| POST | `/centers/:id/reviews` | 👤 who donated there | `rating 1-5, comment?` |
| POST | `/appointments` | 👤 | `centerId, startsAt, notes?, campaignId?, walkIn?`. Eligibility is checked; one active appointment per donor; capacity enforced |
| PATCH | `/appointments/:id` | owner / staff / 🛡 | `startsAt` (reschedule) |
| DELETE | `/appointments/:id` | owner / staff / 🛡 | `{ reason? }` |
| POST | `/appointments/:id/status` | 🧑‍⚕️ / 🛡 | `status: CHECKED_IN \| NO_SHOW` |
| POST | `/staff/walk-in` | 🧑‍⚕️ / 🛡 | `identifier` (donor email or phone), `centerId?` (admin) |

## Inventory & donations

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/inventory?centerId=` | — | Levels per group `{ units, level, expiringSoon }` |
| POST | `/inventory` | 🧑‍⚕️ own center / 🛡 | `centerId, bloodGroup, units, mode: ADD \| ISSUE \| DISCARD, collectedAt?, note?, bloodRequestId?` (ISSUE against a request records fulfilment) |
| POST | `/inventory/expire` | 🧑‍⚕️ (own batches) / 🛡 | `{ batchIds? }`. Leaving out the IDs runs a full sweep (admin only) |
| POST | `/donations` | 🧑‍⚕️ own center / 🛡 | `donorId, centerId, bloodGroup, volumeMl?, appointmentId?, bloodRequestId?, notes?` → `{ certificateNo }` |
| GET | `/certificates/:donationId` | the donor / 🛡 | PDF certificate |

## Moderation & admin

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/reports` | 👤 | `targetUserId? \| bloodRequestId?, reason, details?`. De-duplicated while open |
| PATCH | `/admin/users/:id` | 🛡 | `role?, status?, centerId?, hospitalId?, verifyEmail?, reason?`. Prevents self-lockout and removing the last admin; revokes the user's sessions |
| PATCH | `/admin/reports/:id` | 🛡 | `status: REVIEWING \| RESOLVED \| DISMISSED, action: NONE \| WARN \| SUSPEND \| REMOVE, adminNote?` |
| POST / PATCH | `/admin/campaigns`, `/admin/campaigns/:id` | 🛡 | Campaign fields |
| POST | `/admin/announcements` | 🛡 | `title, message, audience: ALL \| DONORS \| HOSPITALS \| STAFF, push` |
| POST / PATCH | `/admin/centers`, `/admin/centers/:id` | 🛡 | Center fields |
| POST / PATCH | `/admin/locations`, `/admin/locations/:id` | 🛡 | Hierarchy is enforced; locations are deactivated, never deleted |
| GET / PATCH | `/admin/settings` | 🛡 | Runtime settings (interval, radius, thresholds, targets, hotline…) |

## System

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | Database connectivity check |
| GET / POST | `/cron/run` | `Authorization: Bearer $CRON_SECRET` | Reminders, request expiry, batch expiry |
