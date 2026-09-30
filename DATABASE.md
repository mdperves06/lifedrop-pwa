# Database

Relational schema managed with Prisma: [`prisma/schema.prisma`](prisma/schema.prisma). Every table has a `cuid` primary key, foreign keys and timestamps. Enums keep values controlled; for example, a blood group can only ever be one of 8 values.

## Entities

| Model | Purpose | Key fields / notes |
| --- | --- | --- |
| `User` | Account, profile and role | email & phone unique, `passwordHash`, `role`, `status`, `emailVerifiedAt`/`phoneVerifiedAt`, `locationId` (area only), `tokenVersion` (session revocation), `referralCode`/`referredById`, `centerId`/`hospitalId` affiliation, `isDemo`, `deletedAt` |
| `DonorProfile` | Donor-specific data (1:1 with User) | `bloodGroup` (enum), `availability`, `emergencyAvailable`, `lastDonationDate`, `nextAvailableDate`, `healthDeclarationOk`, privacy (`sharePhoneAfterAccept`, `shareEmailAfterAccept`, `showInSearch`), denormalised `locationId` for fast matching |
| `VerificationToken` | Email verify, phone OTP, password reset | **Hashed** (SHA-256) token, expiry, single use, attempt counter |
| `PushSubscription` | Web Push endpoints | endpoint unique, pruned on 404/410 |
| `Location` | Division → District → Area tree | self-relation `parentId`, `nameBn`, approximate centroid `lat/lng`, `isActive` (deactivate, never delete) |
| `Center` | Donation center / blood bank | hours, open days, capacity per hourly slot, staff, beds, equipment (JSON), needed groups (CSV), `statusOverride` |
| `Hospital` | Hospital / clinic | linked hospital staff users |
| `Review` | Donor rating of a center | unique per (center, user); only after donating there |
| `Appointment` | Donation booking | `startsAt` (hour slot), status, walk-in flag, campaign, reminder timestamps |
| `Donation` | Completed donation | blood group, volume, center, certificate number (unique), optional linked request |
| `InventoryBatch` | Units of blood | units, collected/expires, status (AVAILABLE/RESERVED/USED/EXPIRED/DISCARDED), source donation, issued-to request |
| `InventoryLog` | Every stock movement | ±change, reason, actor → history charts |
| `BloodRequest` | A request for blood | group, units, patient, hospital, area, needed time, priority, status, contact preference, units fulfilled, match radius |
| `RequestStatusEvent` | Lifecycle timeline | from → to, actor, note |
| `DonationRequest` | Request sent to one donor | unique per (request, donor), status, source (DIRECT/AUTO_MATCH), distance |
| `Notification` | In-app notification | recipient, type, title, message, link, related request / donation request, `readAt` |
| `Announcement` | Admin broadcast | audience, recipient count |
| `Report` | Moderation report | reporter, target user and/or request, reason, status, action, resolver |
| `AuditLog` | Security / admin audit trail | actor, action, entity, JSON meta, IP |
| `Campaign` | Blood drive | venue, area, center, time window, target, status |
| `AppSetting` | Runtime settings (JSON) | admin-editable: interval, radius, thresholds, targets, hotline… |

## Enums

`Role`, `UserStatus`, `BloodGroup` (A_POS … AB_NEG), `Gender`, `Availability`, `TokenType`, `LocationType`, `CenterStatusOverride`, `AppointmentStatus`, `BatchStatus`, `InventoryReason`, `RequestPriority`, `RequestStatus`, `ContactPreference`, `DonationRequestStatus`, `MatchSource`, `NotificationType`, `ReportReason`, `ReportStatus`, `ModerationAction`, `CampaignStatus`, `Audience`.

## Indexes (chosen for the hot paths)

- **Donor search / matching:** `DonorProfile(bloodGroup, availability, locationId)`, `DonorProfile(locationId)`
- **Request boards:** `BloodRequest(status, priority, createdAt)`, `BloodRequest(locationId, bloodGroup, status)`, `BloodRequest(requesterId, status)`
- **Invites:** `DonationRequest(donorId, status)`, unique `(bloodRequestId, donorId)`
- **Notification centre / unread badge:** `Notification(userId, readAt, createdAt)`
- **Slot capacity:** `Appointment(centerId, startsAt)`; reminders `Appointment(status, startsAt)`
- **Stock:** `InventoryBatch(centerId, bloodGroup, status)`, expiry sweep `InventoryBatch(status, expiresAt)`
- **History:** `InventoryLog(createdAt)`; audit `AuditLog(createdAt)`, `AuditLog(entityType, entityId)`
- **Location tree:** `Location(type, parentId)`, unique `(parentId, name)`

## Switching to PostgreSQL

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/lifedrop?schema=public"`.
3. Create migrations and apply them:
   ```bash
   npx prisma migrate dev --name init      # locally, generates prisma/migrations
   npx prisma migrate deploy               # in CI / production
   ```
4. Optionally load demo data into a **non-production** database with `npm run db:seed`.

No SQLite-specific SQL is used; the only raw query is `SELECT 1` in `/api/health`. Text search uses Prisma `contains`, which is case-sensitive on PostgreSQL. Add `mode: "insensitive"` in `admin/users` if you need case-insensitive search there.

## Demo data

`prisma/seed.ts` **wipes** the database it points at and loads fictional data:

- 8 divisions with districts and areas (Bangla names and coordinates)
- 5 demo centers and 4 demo hospitals
- ~65 donors
- A year of donations, stock batches, appointments, reviews, requests in several states, campaigns, reports and notifications

Everything is labelled "(Demo)" or uses `@lifedrop.test`. **Never run the seed against production.**
