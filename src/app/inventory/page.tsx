import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { getSettings } from "@/server/settings";
import { donationsPerDay, inventoryHistory, stockByGroup } from "@/server/services/inventory";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { BarChart, LineChart, StockGrid } from "@/components/blocks";
import { AutoRefresh } from "@/components/client/auto-refresh";

export const metadata: Metadata = { title: "Blood stock levels", description: "Live city-wide blood stock by blood type." };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [{ t, locale }, settings, stock, history, perDay] = await Promise.all([getDictionary(), getSettings(), stockByGroup(), inventoryHistory(30), donationsPerDay(14)]);
  return (
    <div className="space-y-5">
      <PageHeader title={t.inventory.title} subtitle={t.inventory.subtitle} actions={<LinkButton href="/appointments/new">{t.appointments.book}</LinkButton>} />
      <AutoRefresh seconds={60} label={t.request.autoRefresh} />
      <StockGrid levels={stock} t={t} locale={locale} />
      <div className="flex flex-wrap gap-4 text-sm text-muted">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-success" /> {t.blood.stock.ADEQUATE} (≥ {settings.lowStockUnits})</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-warning" /> {t.blood.stock.LOW}</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-danger" /> {t.blood.stock.CRITICAL} (≤ {settings.criticalStockUnits})</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">{t.inventory.history}</h2>
          <LineChart label={t.inventory.history} data={history.map((h) => ({ label: h.date.slice(5), value: h.total }))} />
        </Card>
        <Card>
          <h2 className="mb-1 font-bold">{t.inventory.target}</h2>
          <p className="mb-2 text-xs text-muted">
            {t.inventory.targetLabel}: {settings.dailyDonationTarget} / {t.common.today.toLowerCase()} — {t.inventory.actualLabel}: {perDay.at(-1)?.count ?? 0}
          </p>
          <BarChart label={t.inventory.target} data={perDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} target={settings.dailyDonationTarget} />
        </Card>
      </div>
    </div>
  );
}
