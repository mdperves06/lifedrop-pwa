import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { analytics } from "@/server/services/stats";
import { bloodLabel } from "@/lib/blood";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { BarChart, HBarList } from "@/components/blocks";

export const metadata = { title: "Analytics" };

export default async function AdminAnalytics() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t, locale } = await getDictionary();
  const a = await analytics();
  const totalDonations = a.trend.reduce((s, m) => s + m.donations, 0);
  const totalRequests = a.trend.reduce((s, m) => s + m.requests, 0);
  return (
    <div className="space-y-4">
      <PageHeader title={t.admin.analytics} subtitle="Last 12 months" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t.home.donations} value={totalDonations} tone="primary" />
        <StatCard label={t.admin.requests} value={totalRequests} tone="info" />
        <StatCard label="Fulfilment rate" value={`${a.fulfilmentRate}%`} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-bold">Donation trend</h2><BarChart label="Donations per month" data={a.trend.map((m) => ({ label: m.month, value: m.donations }))} /></Card>
        <Card><h2 className="mb-3 font-bold">Request trend</h2><BarChart label="Requests per month" data={a.trend.map((m) => ({ label: m.month, value: m.requests }))} color="var(--info)" /></Card>
        <Card><h2 className="mb-3 font-bold">Donors by blood group</h2><HBarList locale={locale} items={a.donorsByGroup.map((g) => ({ label: bloodLabel(g.group), value: g.count }))} /></Card>
        <Card>
          <h2 className="mb-3 font-bold">Blood type demand (requests)</h2>
          <HBarList locale={locale} items={a.demandByGroup.map((g) => ({ label: bloodLabel(g.group), value: g.count }))} />
          <p className="mt-3 text-xs text-muted">Emergency: {a.demandByGroup.filter((g) => g.emergency).map((g) => `${bloodLabel(g.group)} ${g.emergency}`).join(" · ") || "—"}</p>
        </Card>
        <Card><h2 className="mb-3 font-bold">Donor age groups</h2><HBarList locale={locale} items={a.ageBuckets.map((b) => ({ label: b.bucket, value: b.count }))} /></Card>
        <Card><h2 className="mb-3 font-bold">Donor gender</h2><HBarList locale={locale} items={a.gender.map((g) => ({ label: g.gender.slice(0, 6), value: g.count }))} /></Card>
      </div>
    </div>
  );
}
