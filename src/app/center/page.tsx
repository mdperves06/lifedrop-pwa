import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { liveStatus, parseGroups } from "@/server/services/centers";
import { donationsPerDay, stockByGroup } from "@/server/services/inventory";
import { addDays, formatDate, formatTime, startOfLocalDay } from "@/lib/time";
import { bloodLabel } from "@/lib/blood";
import { Badge, Card, EmptyState, PageHeader, StatCard, cx } from "@/components/ui";
import { BarChart, StockGrid } from "@/components/blocks";
import { AppointmentRow, CenterStatusForm, InventoryForm, MarkExpired, WalkInForm } from "./client";

export const metadata: Metadata = { title: "Center portal", robots: { index: false } };

export default async function CenterPortal({ searchParams }: { searchParams: Promise<{ centerId?: string }> }) {
  const user = await requirePageUser("CENTER_STAFF", "ADMIN");
  const [{ t, locale }, sp, settings] = await Promise.all([getDictionary(), searchParams, getSettings()]);
  const allCenters = user.role === "ADMIN" ? await db.center.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const centerId = user.role === "CENTER_STAFF" ? user.centerId : sp.centerId ?? allCenters[0]?.id;
  if (!centerId) return <EmptyState title={t.errors.forbidden} />;
  const center = await db.center.findUnique({ where: { id: centerId } });
  if (!center) return <EmptyState title={t.errors.notFound} />;

  const dayStart = startOfLocalDay(new Date());
  const [status, appts, stock, batches, perDay] = await Promise.all([
    liveStatus(center),
    db.appointment.findMany({
      where: { centerId, OR: [{ startsAt: { gte: dayStart, lt: addDays(dayStart, 1) } }, { status: "CHECKED_IN" }] },
      orderBy: { startsAt: "asc" },
      include: { donor: { select: { id: true, name: true, phone: true, donorProfile: { select: { bloodGroup: true } } } }, donation: { select: { id: true } } },
    }),
    stockByGroup(centerId),
    db.inventoryBatch.findMany({ where: { centerId, status: "AVAILABLE" }, orderBy: { expiresAt: "asc" }, take: 40 }),
    donationsPerDay(14, centerId),
  ]);
  const todayCount = perDay.at(-1)?.count ?? 0;
  const perCenterTarget = Math.max(1, Math.round(settings.dailyDonationTarget / Math.max(1, allCenters.length || (await db.center.count({ where: { isActive: true } })))));
  const now = new Date().getTime();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.staff.title}
        subtitle={center.name}
        actions={
          user.role === "ADMIN" && allCenters.length > 1 ? (
            <nav className="flex flex-wrap gap-1" aria-label={t.admin.centers}>
              {allCenters.map((c) => (
                <Link key={c.id} href={`/center?centerId=${c.id}`} className={cx("rounded-full px-3 py-1.5 text-xs font-medium", c.id === centerId ? "bg-fg text-bg" : "bg-surface-2")}>{c.name.replace(/^LifeDrop /, "").replace(/ \(Demo\)$/, "")}</Link>
              ))}
            </nav>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.staff.centerStatus} value={<Badge tone={status === "OPEN" ? "success" : status === "FULL" ? "warning" : "neutral"} className="text-base">{t.common[status.toLowerCase() as "open" | "closed" | "full"]}</Badge>} />
        <StatCard label={t.staff.todays} value={appts.length} />
        <StatCard label={`${t.inventory.actualLabel} / ${t.inventory.targetLabel}`} value={`${todayCount} / ${perCenterTarget}`} tone={todayCount >= perCenterTarget ? "success" : "warning"} />
        <StatCard label={t.inventory.expiring} value={stock.reduce((s, g) => s + g.expiringSoon, 0)} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-3 font-bold">{t.staff.todays}</h2>
          {appts.length === 0 ? (
            <p className="text-sm text-muted">{t.staff.noAppointments}</p>
          ) : (
            <ul className="divide-y divide-border">
              {appts.map((a) => (
                <AppointmentRow
                  key={a.id}
                  a={{ id: a.id, time: formatTime(a.startsAt, locale), status: a.status, isWalkIn: a.isWalkIn, donorId: a.donor.id, donorName: a.donor.name, donorPhone: a.donor.phone, bloodGroup: a.donor.donorProfile?.bloodGroup ?? "O_POS", recorded: !!a.donation }}
                  centerId={centerId}
                />
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <WalkInForm centerId={centerId} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">{t.staff.centerStatus}</h2>
          <CenterStatusForm centerId={centerId} statusOverride={center.statusOverride} needed={parseGroups(center.neededBloodGroups)} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">{t.centers.stock}</h2>
        <StockGrid levels={stock} t={t} locale={locale} />
        <div className="mt-4 border-t border-border pt-4">
          <InventoryForm centerId={centerId} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">{t.inventory.batches}</h2>
          {batches.length === 0 ? (
            <p className="text-sm text-muted">{t.common.noResults}</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-muted">
                  <tr><th className="py-1.5 font-medium">{t.common.bloodGroup}</th><th className="font-medium">{t.common.units}</th><th className="font-medium">{t.inventory.collected}</th><th className="font-medium">{t.inventory.expires}</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((b) => {
                    const expired = b.expiresAt.getTime() <= now;
                    const soon = b.expiresAt.getTime() - now < 7 * 86_400_000;
                    return (
                      <tr key={b.id} className={cx(expired && "bg-danger-soft", !expired && soon && "bg-warning-soft")}>
                        <td className="py-1.5 font-semibold">{bloodLabel(b.bloodGroup)}</td>
                        <td>{b.units}</td>
                        <td>{formatDate(b.collectedAt, locale)}</td>
                        <td>{formatDate(b.expiresAt, locale)}</td>
                        <td className="text-right">{(expired || soon) && <MarkExpired batchId={b.id} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">{t.inventory.target}</h2>
          <BarChart label={t.inventory.target} data={perDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} target={perCenterTarget} />
        </Card>
      </div>
    </div>
  );
}
