import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n";
import { requirePageUser } from "@/server/auth/guard";
import { isVerified } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { locationLabel } from "@/server/services/locations";
import { LIVES_PER_DONATION } from "@/server/services/stats";
import { badgeFor, nextEligibleDate } from "@/lib/eligibility";
import { bloodLabel } from "@/lib/blood";
import { formatDate, formatDateTime } from "@/lib/time";
import { Badge, BloodBadge, Card, CalendarIcon, DownloadIcon, HeartIcon, LinkButton, MapPinIcon, PlusIcon, SearchIcon, ShieldIcon, StatCard, StarIcon, cx } from "@/components/ui";
import { AvailabilityCard, CopyLink, VerifyBanner } from "./client";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const NEXT_TIER = { NONE: ["BRONZE", 1], BRONZE: ["SILVER", 5], SILVER: ["GOLD", 10], GOLD: [null, 0] } as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser();
  const [{ t, locale }, settings, sp] = await Promise.all([getDictionary(), getSettings(), searchParams]);
  const [full, donations, received, accepted, upcoming, referrals, usedUnits] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, include: { donorProfile: true } }),
    db.donation.findMany({ where: { donorId: user.id }, orderBy: { donatedAt: "desc" }, include: { center: { select: { name: true } } } }),
    db.donationRequest.count({ where: { donorId: user.id } }),
    db.donationRequest.count({ where: { donorId: user.id, status: { in: ["ACCEPTED", "DONATED"] } } }),
    db.appointment.findFirst({ where: { donorId: user.id, status: { in: ["BOOKED", "CHECKED_IN"] } }, orderBy: { startsAt: "asc" }, include: { center: { select: { name: true, address: true } } } }),
    db.user.count({ where: { referredById: user.id } }),
    db.inventoryBatch.aggregate({ where: { donation: { donorId: user.id }, status: "USED" }, _sum: { units: true } }),
  ]);
  const dp = full!.donorProfile;
  const area = await locationLabel(full!.locationId, locale);
  const next = nextEligibleDate(dp?.lastDonationDate, settings.donationIntervalDays);
  const eligibleNow = !next || next <= new Date();
  const badge = badgeFor(donations.length);
  const [nextTier, nextAt] = NEXT_TIER[badge];
  const directed = donations.filter((d) => d.bloodRequestId).length;
  const used = (usedUnits._sum.units ?? 0) + directed;
  const completionFields = [full!.name, full!.phone, full!.locationId, full!.dateOfBirth, dp?.bloodGroup, dp?.weightKg, full!.avatarPath, full!.emailVerifiedAt || full!.phoneVerifiedAt, dp?.healthDeclarationOk];
  const completion = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const referralUrl = `${env.appUrl}/register?ref=${full!.referralCode}`;

  const roleLinks =
    user.role === "ADMIN" ? { href: "/admin", label: t.nav.admin } : user.role === "CENTER_STAFF" ? { href: "/center", label: t.nav.centerPortal } : user.role === "HOSPITAL" ? { href: "/hospital", label: t.nav.hospitalPortal } : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t.dashboard.title}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{fmt(t.dashboard.hello, { name: full!.name.split(" ")[0] })}</h1>
        </div>
        {roleLinks && <LinkButton href={roleLinks.href} variant="outline"><ShieldIcon className="size-4" /> {roleLinks.label}</LinkButton>}
      </div>

      {sp.welcome && <Card className="border-success/40 bg-success-soft">{t.auth.verifyEmailBanner}</Card>}
      {!isVerified(user) && <VerifyBanner hasEmail={!user.emailVerifiedAt} />}

      {dp ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <AvailabilityCard availability={dp.availability} emergency={dp.emergencyAvailable} />
          <Card className="flex items-center gap-4">
            <BloodBadge group={dp.bloodGroup} size="lg" />
            <div className="min-w-0 text-sm">
              <p className="text-muted">{t.dashboard.yourGroup}</p>
              <p className="text-lg font-bold">{bloodLabel(dp.bloodGroup)}</p>
              <p className="flex items-center gap-1 text-muted"><MapPinIcon className="size-4" /> {area || t.search.locationNotSet}</p>
            </div>
          </Card>
          <Card className="text-sm">
            <p className="text-muted">{t.dashboard.lastDonation}</p>
            <p className="font-semibold">{dp.lastDonationDate ? formatDate(dp.lastDonationDate, locale) : t.dashboard.never}</p>
            <p className="mt-2 text-muted">{t.dashboard.nextEligible}</p>
            <p className={cx("font-semibold", eligibleNow ? "text-success" : "text-warning")}>{eligibleNow ? t.dashboard.eligibleNow : formatDate(next!, locale)}</p>
            <p className="mt-2 text-xs text-muted">{t.app.disclaimer.split(". ").slice(-1)[0]}</p>
          </Card>
        </div>
      ) : (
        <Card>
          <p>{t.appointments.issues.NO_PROFILE}</p>
          <LinkButton href="/profile" className="mt-3">{t.nav.profile}</LinkButton>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.dashboard.received} value={formatNumber(received, locale)} icon={<HeartIcon />} tone="primary" />
        <StatCard label={t.dashboard.accepted} value={formatNumber(accepted, locale)} icon={<HeartIcon />} tone="success" />
        <StatCard label={t.dashboard.donationsCount} value={formatNumber(donations.length, locale)} icon={<StarIcon className="size-5" filled />} tone="warning" />
        <StatCard label={fmt(t.profile.completion, { n: completion })} value={`${completion}%`} icon={<ShieldIcon />} tone="info" hint={completion < 100 ? <Link href="/profile" className="text-primary">{t.nav.profile} →</Link> : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-2 font-bold">{t.dashboard.upcoming}</h2>
          {upcoming ? (
            <div className="text-sm">
              <p className="font-semibold">{upcoming.center.name}</p>
              <p className="text-muted">{upcoming.center.address}</p>
              <p className="mt-1 flex items-center gap-1.5"><CalendarIcon className="size-4" /> {formatDateTime(upcoming.startsAt, locale)}</p>
              <LinkButton href="/appointments" size="sm" variant="outline" className="mt-3">{t.nav.appointments}</LinkButton>
            </div>
          ) : (
            <div className="text-sm text-muted">
              <p>{t.dashboard.noUpcoming}</p>
              <LinkButton href="/appointments/new" size="sm" className="mt-3"><CalendarIcon className="size-4" /> {t.appointments.book}</LinkButton>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">{t.dashboard.badges}</h2>
          <div className="flex items-center gap-3">
            <span className={cx("grid size-14 place-items-center rounded-full text-2xl", badge === "GOLD" ? "bg-yellow-400/25 text-yellow-600" : badge === "SILVER" ? "bg-slate-300/40 text-slate-500" : badge === "BRONZE" ? "bg-orange-300/30 text-orange-700" : "bg-surface-2 text-muted")} aria-hidden="true">
              <StarIcon className="size-7" filled={badge !== "NONE"} />
            </span>
            <div className="text-sm">
              <p className="font-semibold">{t.dashboard[`badge${badge}`]}</p>
              {nextTier && <p className="text-muted">{fmt(t.dashboard.badgeProgress, { n: nextAt - donations.length, next: t.dashboard[`badge${nextTier}`] })}</p>}
            </div>
          </div>
          <h3 className="mb-1 mt-4 text-sm font-semibold">{t.dashboard.impact}</h3>
          <p className="text-sm text-muted">{fmt(t.dashboard.impactBody, { n: donations.length, lives: donations.length * LIVES_PER_DONATION, used })}</p>
        </Card>

        <Card>
          <h2 className="mb-2 font-bold">{t.dashboard.referral}</h2>
          <p className="mb-3 text-sm text-muted">{fmt(t.dashboard.referralBody, { n: referrals })}</p>
          <CopyLink url={referralUrl} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">{t.dashboard.quickActions}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LinkButton href="/incoming" variant="secondary"><HeartIcon className="size-4" /> {t.nav.incoming}</LinkButton>
          <LinkButton href="/my-requests" variant="secondary">{t.nav.myRequests}</LinkButton>
          <LinkButton href="/donors" variant="secondary"><SearchIcon className="size-4" /> {t.nav.findDonors}</LinkButton>
          <LinkButton href="/requests/new" variant="secondary"><PlusIcon className="size-4" /> {t.nav.requestBlood}</LinkButton>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">{t.dashboard.history}</h2>
        {donations.length === 0 ? (
          <p className="text-sm text-muted">{t.dashboard.noHistory}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">{t.common.date}</th>
                  <th className="py-2 font-medium">{t.dashboard.center}</th>
                  <th className="py-2 font-medium">{t.common.bloodGroup}</th>
                  <th className="py-2 font-medium">{t.dashboard.volume}</th>
                  <th className="py-2 font-medium"><span className="sr-only">{t.dashboard.certificate}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5">{formatDate(d.donatedAt, locale)}</td>
                    <td className="py-2.5">{d.center?.name ?? "—"}</td>
                    <td className="py-2.5"><Badge tone="primary">{bloodLabel(d.bloodGroup)}</Badge></td>
                    <td className="py-2.5">{d.volumeMl} ml</td>
                    <td className="py-2.5 text-right">
                      <a href={`/api/certificates/${d.id}`} className="inline-flex items-center gap-1 font-semibold text-primary" download>
                        <DownloadIcon className="size-4" /> {t.dashboard.certificate}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
