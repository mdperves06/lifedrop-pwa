import { requirePageUser } from "@/server/auth/guard";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { donationsPerDay, inventoryHistory, stockByGroup } from "@/server/services/inventory";
import { BLOOD_GROUPS, bloodLabel } from "@/lib/blood";
import { addDays, formatDate, formatDateTime } from "@/lib/time";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { BarChart, LineChart, StockGrid } from "@/components/blocks";
import { AdminInventoryForm, ExpirySweep } from "../forms";

export const metadata = { title: "Inventory" };

export default async function AdminInventory() {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const { t, locale } = await getDictionary();
  const now = new Date();
  const [settings, stock, centers, history, perDay, expiring, logs] = await Promise.all([
    getSettings(),
    stockByGroup(),
    db.center.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    inventoryHistory(30),
    donationsPerDay(14),
    db.inventoryBatch.findMany({ where: { status: "AVAILABLE", expiresAt: { lte: addDays(now, 7) } }, orderBy: { expiresAt: "asc" }, include: { center: { select: { name: true } } }, take: 50 }),
    db.inventoryLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { center: { select: { name: true } }, user: { select: { name: true } } } }),
  ]);
  const perCenter = await Promise.all(centers.map(async (c) => ({ ...c, stock: await stockByGroup(c.id) })));

  return (
    <div className="space-y-5">
      <PageHeader title={t.admin.inventory} actions={<ExpirySweep />} />
      <StockGrid levels={stock} t={t} locale={locale} />
      <Card>
        <h2 className="mb-3 font-bold">{t.inventory.adjust}</h2>
        <AdminInventoryForm centers={centers} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-bold">{t.inventory.history}</h2><LineChart label={t.inventory.history} data={history.map((h) => ({ label: h.date.slice(5), value: h.total }))} /></Card>
        <Card><h2 className="mb-3 font-bold">{t.inventory.target}</h2><BarChart label={t.inventory.target} data={perDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} target={settings.dailyDonationTarget} /></Card>
      </div>
      <Card className="overflow-x-auto">
        <h2 className="mb-3 font-bold">{t.inventory.byCenter}</h2>
        <table className="w-full min-w-[640px] text-center text-sm">
          <thead className="text-muted"><tr><th className="py-2 text-left font-medium">{t.dashboard.center}</th>{BLOOD_GROUPS.map((g) => <th key={g} className="font-semibold">{bloodLabel(g)}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {perCenter.map((c) => (
              <tr key={c.id}>
                <td className="py-2 text-left font-medium">{c.name}</td>
                {c.stock.map((s) => <td key={s.bloodGroup} className={cx("tabular-nums", s.level === "CRITICAL" ? "text-danger font-bold" : s.level === "LOW" ? "text-warning font-semibold" : "")}>{s.units}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">{t.inventory.expiring}</h2>
          {expiring.length === 0 ? <p className="text-sm text-muted">{t.common.noResults}</p> : (
            <ul className="divide-y divide-border text-sm">
              {expiring.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span><Badge tone="primary">{bloodLabel(b.bloodGroup)}</Badge> × {b.units} · {b.center.name}</span>
                  <span className={cx("text-xs", b.expiresAt <= now ? "font-bold text-danger" : "text-warning")}>{formatDate(b.expiresAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Recent movements</h2>
          <ul className="divide-y divide-border text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate"><span className={cx("font-bold tabular-nums", l.change > 0 ? "text-success" : "text-danger")}>{l.change > 0 ? "+" : ""}{l.change}</span> {bloodLabel(l.bloodGroup)} · {l.reason} · {l.center.name}{l.user ? ` · ${l.user.name}` : ""}</span>
                <span className="shrink-0 text-xs text-muted">{formatDateTime(l.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
