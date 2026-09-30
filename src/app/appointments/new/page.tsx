import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { donorEligibility } from "@/server/services/appointments";
import { formatDate, formatDateTime } from "@/lib/time";
import { Alert, LinkButton, PageHeader } from "@/components/ui";
import { BookingWizard } from "./wizard";

export const metadata: Metadata = { title: "Book appointment", robots: { index: false } };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ centerId?: string; campaignId?: string; reschedule?: string }> }) {
  const user = await requirePageUser();
  const [{ t, locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const [centers, elig, existing, campaign] = await Promise.all([
    db.center.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, openTime: true, closeTime: true } }),
    donorEligibility(user.id),
    db.appointment.findFirst({ where: { donorId: user.id, status: { in: ["BOOKED", "CHECKED_IN"] } }, include: { center: { select: { name: true } } } }),
    sp.campaignId ? db.campaign.findUnique({ where: { id: sp.campaignId }, select: { id: true, title: true, centerId: true } }) : null,
  ]);
  const rescheduling = sp.reschedule && existing?.id === sp.reschedule ? existing : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={rescheduling ? t.appointments.reschedule : t.appointments.bookTitle} subtitle={campaign ? campaign.title : undefined} />
      {existing && !rescheduling && (
        <Alert tone="info" className="mb-4" title={t.dashboard.upcoming}>
          {existing.center.name} — {formatDateTime(existing.startsAt, locale)}
          <div className="mt-2 flex gap-2">
            <LinkButton size="sm" variant="outline" href={`/appointments/new?reschedule=${existing.id}&centerId=${existing.centerId}`}>{t.appointments.reschedule}</LinkButton>
            <LinkButton size="sm" variant="ghost" href="/appointments">{t.nav.appointments}</LinkButton>
          </div>
        </Alert>
      )}
      {!elig.eligible && (
        <Alert tone="warning" className="mb-4" title={t.appointments.notEligible}>
          <ul className="list-disc pl-5">
            {elig.issues.map((i) => <li key={i}>{t.appointments.issues[i]}</li>)}
          </ul>
          {elig.nextEligibleDate && <p className="mt-1 font-medium">{fmt(t.availability.eligibleFrom, { date: formatDate(elig.nextEligibleDate, locale) })}</p>}
          <LinkButton size="sm" variant="outline" href="/profile" className="mt-2">{t.nav.profile}</LinkButton>
        </Alert>
      )}
      <BookingWizard
        centers={centers}
        initialCenterId={sp.centerId ?? campaign?.centerId ?? undefined}
        campaignId={campaign?.id}
        rescheduleId={rescheduling?.id}
        disabled={(!!existing && !rescheduling) || (!elig.eligible && !elig.issues.every((i) => i === "TOO_SOON"))}
        earliest={elig.nextEligibleDate?.toISOString() ?? null}
      />
      <p className="mt-6 text-xs text-muted">{t.app.disclaimer}</p>
    </div>
  );
}
