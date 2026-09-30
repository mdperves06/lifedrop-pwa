import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { formatNumber } from "@/i18n";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { adminMetrics } from "@/server/services/stats";
import { stockByGroup } from "@/server/services/inventory";
import { publicRequestBoard } from "@/server/services/request-views";
import { relativeTime } from "@/lib/time";
import { AlertIcon, Card, ChartIcon, FlagIcon, HeartIcon, PageHeader, StatCard, UserIcon, CalendarIcon, DropIcon } from "@/components/ui";
import { RequestCard, StockGrid } from "@/components/blocks";

export default async function AdminOverview() {
  const user = await requirePageUser("ADMIN");
  const { t, locale } = await getDictionary();
  const [m, stock, emergencies, alerts] = await Promise.all([
    adminMetrics(),
    stockByGroup(),
    publicRequestBoard(4, true),
    db.notification.findMany({ where: { userId: user.id, type: { in: ["LOW_STOCK", "REPORT_UPDATE"] }, readAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <div className="space-y-5">
      <PageHeader title={t.admin.title} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label={t.admin.totalUsers} value={n(m.users)} icon={<UserIcon />} />
        <StatCard label={t.admin.totalDonors} value={n(m.donors)} icon={<DropIcon />} tone="primary" />
        <StatCard label={t.admin.activeDonors} value={n(m.activeDonors)} icon={<HeartIcon />} tone="success" />
        <StatCard label={t.admin.donationsThisMonth} value={n(m.donationsThisMonth)} icon={<ChartIcon />} tone="info" />
        <StatCard label={t.admin.bloodCollected} value={n(m.litersThisMonth)} icon={<DropIcon />} tone="primary" />
        <StatCard label={t.admin.activeRequests} value={n(m.activeRequests)} icon={<AlertIcon />} tone="warning" />
        <StatCard label={t.admin.emergencyRequests} value={n(m.emergencyRequests)} icon={<AlertIcon />} tone="danger" />
        <StatCard label={t.admin.fulfilledRequests} value={n(m.fulfilledRequests)} icon={<HeartIcon />} tone="success" />
        <StatCard label={t.admin.pendingReports} value={<Link href="/admin/reports" className="hover:text-primary">{n(m.pendingReports)}</Link>} icon={<FlagIcon />} tone="warning" />
        <StatCard label={t.admin.upcomingAppointments} value={n(m.upcomingAppointments)} icon={<CalendarIcon />} tone="info" />
      </div>

      {alerts.length > 0 && (
        <Card className="border-warning/40">
          <h2 className="mb-2 font-bold">{t.inventory.lowAlert}</h2>
          <ul className="divide-y divide-border text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                <span><span className="font-semibold">{a.title}</span> — {a.message}</span>
                <span className="shrink-0 text-xs text-muted">{relativeTime(a.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t.home.stockTitle}</h2>
          <Link href="/admin/inventory" className="text-sm font-semibold text-primary">{t.common.viewAll}</Link>
        </div>
        <StockGrid levels={stock} t={t} locale={locale} />
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t.home.recentEmergencies}</h2>
          <Link href="/admin/requests?priority=EMERGENCY" className="text-sm font-semibold text-primary">{t.common.viewAll}</Link>
        </div>
        {emergencies.length ? <div className="grid gap-3 md:grid-cols-2">{emergencies.map((r) => <RequestCard key={r.id} r={r} t={t} locale={locale} />)}</div> : <p className="text-sm text-muted">{t.home.noEmergencies}</p>}
      </section>
    </div>
  );
}
