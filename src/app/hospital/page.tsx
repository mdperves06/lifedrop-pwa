import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { locationMap } from "@/server/services/locations";
import { stockByGroup } from "@/server/services/inventory";
import { ACTIVE_STATUSES } from "@/lib/lifecycle";
import { AlertIcon, Card, EmptyState, LinkButton, PageHeader, PhoneIcon, PlusIcon, StatCard, buttonClass } from "@/components/ui";
import { RequestCard, StockGrid } from "@/components/blocks";
import { AutoRefresh } from "@/components/client/auto-refresh";

export const metadata: Metadata = { title: "Hospital portal", robots: { index: false } };

export default async function HospitalPortal() {
  const user = await requirePageUser("HOSPITAL", "ADMIN");
  const [{ t, locale }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const scope = user.hospitalId ? { OR: [{ hospitalId: user.hospitalId }, { requesterId: user.id }] } : { requesterId: user.id };
  const [hospital, active, recent, stock, locs] = await Promise.all([
    user.hospitalId ? db.hospital.findUnique({ where: { id: user.hospitalId } }) : null,
    db.bloodRequest.findMany({ where: { ...scope, status: { in: ACTIVE_STATUSES } }, orderBy: [{ priority: "desc" }, { neededAt: "asc" }], include: { donationRequests: { select: { status: true } } } }),
    db.bloodRequest.findMany({ where: { ...scope, status: { notIn: ACTIVE_STATUSES } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    stockByGroup(),
    locationMap(),
  ]);
  const card = (r: (typeof recent)[number]) => {
    const a = locs.get(r.locationId);
    return <RequestCard key={r.id} r={{ ...r, area: a?.name ?? "", areaBn: a?.nameBn ?? a?.name ?? "" }} t={t} locale={locale} />;
  };
  const accepted = active.reduce((s, r) => s + r.donationRequests.filter((d) => d.status === "ACCEPTED").length, 0);
  const pending = active.reduce((s, r) => s + r.donationRequests.filter((d) => d.status === "PENDING").length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.hospital.title}
        subtitle={hospital ? `${hospital.name} — ${t.hospital.subtitle}` : t.hospital.subtitle}
        actions={
          <>
            <LinkButton href="/requests/new?priority=EMERGENCY" variant="danger"><AlertIcon className="size-4" /> {t.hospital.newEmergency}</LinkButton>
            <LinkButton href="/requests/new" variant="outline"><PlusIcon className="size-4" /> {t.nav.requestBlood}</LinkButton>
            <a className={buttonClass("ghost")} href={`tel:${settings.hotlinePhone}`}><PhoneIcon className="size-4" /> {settings.hotlinePhone}</a>
          </>
        }
      />
      <AutoRefresh seconds={15} label={t.request.autoRefresh} />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t.admin.activeRequests} value={active.length} tone="info" />
        <StatCard label={t.donationRequestStatus.PENDING} value={pending} tone="warning" />
        <StatCard label={t.donationRequestStatus.ACCEPTED} value={accepted} tone="success" />
      </div>
      <section>
        <h2 className="mb-3 font-bold">{t.request.active}</h2>
        {active.length === 0 ? <EmptyState title={t.request.noRequests} /> : <div className="grid gap-3 md:grid-cols-2">{active.map(card)}</div>}
      </section>
      <Card>
        <h2 className="mb-3 font-bold">{t.home.stockTitle}</h2>
        <StockGrid levels={stock} t={t} locale={locale} />
      </Card>
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">{t.request.completed} / {t.request.cancelledExpired}</h2>
          <div className="grid gap-3 md:grid-cols-2">{recent.map(card)}</div>
        </section>
      )}
    </div>
  );
}
