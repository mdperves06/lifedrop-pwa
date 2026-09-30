# Security

LifeDrop handles sensitive personal data: phone numbers, health declarations, locations and patient names. It is designed on the assumption that **the frontend is untrusted**. Every permission check and every validation also runs on the server.

## Controls

| Threat | Control | Where |
| --- | --- | --- |
| Credential theft | bcrypt (cost 12); constant-work login (a dummy hash when the user doesn't exist); generic "incorrect email/phone or password" | `server/auth/session.ts`, `services/auth.ts` |
| Brute force / abuse | In-memory rate limits: login per account (10/15 min) and per IP (50/15 min), register, reset, OTP, search, request creation, reports, avatar uploads. OTP allows at most 5 attempts | `server/http.ts`, routes |
| Session hijack | JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie. Every request re-checks the DB for status and `tokenVersion`. Sessions are revoked on password reset, role change, suspension and deletion | `session.ts` |
| CSRF | SameSite cookie **plus** a strict `Origin`/`Referer` host check on every state-changing API call | `handler()` |
| Privilege escalation | Registration always creates `DONOR`. Role and status changes only happen through admin endpoints. Self-lockout and last-admin removal are blocked. Staff are scoped to their own center, hospital users to their hospital | `services/admin.ts`, `inventory.ts` |
| Broken access control | `requireUser`/`requireRole` in **every** API route. `requirePageUser` in every private page, including each admin page (not only the layout). Ownership checks on requests, invites, appointments and certificates | routes, services |
| Injection | Prisma parameterised queries only (no raw SQL except `SELECT 1`). zod validation on every input, with enums for controlled values (blood groups, roles, statuses) | `lib/validation.ts` |
| XSS | React escaping. No user HTML is rendered. Map popups use `textContent`. The only inline script is a static theme bootstrap. CSP restricts all sources (script `'self' 'unsafe-inline'`, which Next.js needs for its inline bootstrap) | `next.config.ts` |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict referrer policy, HSTS in production | `next.config.ts` |
| Unsafe uploads | 1 MB limit. Type is detected from **magic bytes** (PNG/JPEG/WebP), not the client MIME type. Random filenames written with the exclusive flag. Served with strict CSP and `nosniff`. Path traversal is prevented by a filename regex | `server/storage.ts` |
| Open redirect | The post-login `next=` parameter only accepts same-site paths (rejects `//`, `\`, control characters) | `lib/safe-redirect.ts` |
| Account enumeration | Forgot-password always returns the same response. Registration does reveal "already registered" (a usability trade-off), mitigated by a 5/hour/IP limit | `services/auth.ts` |
| Token leakage | Verification, reset and OTP tokens are stored **hashed** (SHA-256), are single use and expire. Dev-only exposure of links and OTPs is disabled in production | `services/auth.ts`, `env.ts` |
| Privacy | Public search returns only name (abbreviated for anonymous viewers), group, area, availability and verified flag. No phone, email, address or coordinates are ever shown publicly. Donor contact details are revealed only **after acceptance** and only per the donor's toggles. Locations are area-level centroids, never GPS. The browser's geolocation is used only on the client, to sort centers, and is never sent. Patient names are hidden from the public board | `services/donors.ts`, `request-views.ts` |
| Secrets | `.env*` is git-ignored (except `.env.example`). The app refuses to start in production without a strong `JWT_SECRET`. The cron endpoint uses a timing-safe secret comparison | `.gitignore`, `env.ts`, `api/cron` |
| Accountability | `AuditLog` records logins, registrations, resets, profile changes, requests, inventory moves, donations, and every admin action (with IP) | `server/audit.ts` |
| Offline cache leaks | The service worker never caches `/api` or private pages, and clears its page cache on account deletion | `public/sw.js` |
| Search indexing | Private routes send `X-Robots-Tag: noindex` and `robots` meta; `robots.txt` disallows them | `proxy.ts`, `app/robots.ts` |

## Deployment checklist

- [ ] HTTPS everywhere; `APP_URL` set to the public origin
- [ ] `JWT_SECRET` ≥ 32 random chars, `CRON_SECRET` set, VAPID keys generated per environment
- [ ] `EXPOSE_DEV_SECRETS` unset or `false` (it is ignored in production anyway)
- [ ] PostgreSQL with least-privilege credentials, TLS and backups
- [ ] **Multiple instances:** move rate limiting to a shared store (Redis) and avatars to object storage (only `server/storage.ts` changes)
- [ ] Never run `prisma/seed.ts` against production
- [ ] Monitor `/api/health`; ship server logs (they contain `[audit]`, `[push]`, `[sms]` errors)
- [ ] Set up SMTP / SMS providers; the console providers are for development only

## Known limitations

- The rate limiter is per-process memory, so it resets on restart and isn't shared between instances.
- The CSP allows `'unsafe-inline'` scripts (Next.js inline bootstrap). A nonce-based CSP is possible but makes every page dynamic.
- Phone OTP verifies ownership after registration; there is no OTP-only login yet.
- No malware scanning of uploads (images only, 1 MB, re-served with a locked-down CSP).

## Reporting vulnerabilities

Please report security issues privately to the maintainers rather than opening a public issue.
