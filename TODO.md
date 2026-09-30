# TODO / Roadmap

The MVP is feature-complete. These items are follow-ups, not missing core functionality.

## Operational hardening (before a large-scale launch)

- [ ] Shared rate limiter (Redis / Upstash) for multi-instance deployments
- [ ] Object storage for avatars (S3 / R2); swap the three functions in `src/server/storage.ts`
- [ ] PostgreSQL migrations committed (`prisma migrate dev --name init`) and CI running `lint`, `typecheck`, `test` and `smoke`
- [ ] Real SMS gateway for Bangladesh (e.g. SSL Wireless / BulkSMSBD) implementing `SmsProvider`
- [ ] Transactional email templates (HTML) and bounce handling
- [ ] Error monitoring (Sentry) and structured logging
- [ ] Nonce-based CSP to drop `'unsafe-inline'`
- [ ] Browser end-to-end tests (Playwright), including an installed-PWA and push test on real devices

## Product ideas (future-ready architecture already in place)

- [ ] SMS OTP **login** (OTP verification already exists)
- [ ] Verified-donor badge after an in-person center check
- [ ] Blood-bank / NGO / volunteer-organisation accounts
- [ ] WhatsApp / Telegram notification channels
- [ ] Distance-based donor search on a map (area centroids and `distanceKm` already computed)
- [ ] Donation reminders when a donor becomes eligible again
- [ ] Public emergency campaigns and shareable appeal pages
- [ ] Two-way in-app messaging between requester and accepted donor
- [ ] Center capacity per staff shift, and holiday calendars
- [ ] Bangla-script PDF certificates (embed a Bengali font in `pdf-lib`)
- [ ] Case-insensitive admin search on PostgreSQL (`mode: "insensitive"`)
- [ ] Real-time transport (SSE / WebSocket) in place of polling where the host allows it

## Deliberately excluded (per product scope)

Payments, blood selling, subscriptions, public donor rankings or leaderboards, GPS tracking, social feed, video calls, AI chatbot, crypto, native apps, hospital billing, pharmacy management.
