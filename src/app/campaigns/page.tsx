import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { getSettings } from "@/server/settings";
import { db } from "@/server/db";
import { formatDateTime, formatTime } from "@/lib/time";
import { Badge, Card, CalendarIcon, EmptyState, LinkButton, MapPinIcon, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Blood donation drives", description: "Upcoming blood donation camps and drives." };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [{ t, locale }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] }, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { location: { select: { name: true, nameBn: true } }, _count: { select: { appointments: { where: { status: { not: "CANCELLED" } } } } } },
  });
  return (
    <div>
      <PageHeader title={t.campaigns.title} subtitle={fmt(t.campaigns.subtitle, { city: settings.cityName })} />
      {campaigns.length === 0 ? (
        <EmptyState icon={<CalendarIcon className="size-10" />} title={t.campaigns.none} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const pct = Math.min(100, Math.round((c._count.appointments / c.targetDonors) * 100));
            return (
              <li key={c.id}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold">{c.title}</h2>
                    {c.status === "ACTIVE" && <Badge tone="success">{t.common.open}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{c.description}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm"><CalendarIcon className="size-4" /> {formatDateTime(c.startsAt, locale)} – {formatTime(c.endsAt, locale)}</p>
                  <p className="flex items-center gap-1.5 text-sm"><MapPinIcon className="size-4" /> {c.venue}, {locale === "bn" ? c.location.nameBn ?? c.location.name : c.location.name}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted">
                      <span>{fmt(t.campaigns.booked, { n: c._count.appointments })}</span>
                      <span>{fmt(t.campaigns.target, { n: c.targetDonors })}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-auto pt-4">
                    <LinkButton href={`/appointments/new?campaignId=${c.id}${c.centerId ? `&centerId=${c.centerId}` : ""}`} size="sm">{t.campaigns.join}</LinkButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
