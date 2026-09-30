import { requirePageUser } from "@/server/auth/guard";
import type { Prisma } from "@prisma/client";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/time";
import { Card, PageHeader, Pagination, inputClass } from "@/components/ui";

export const metadata = { title: "Audit logs" };
const PAGE = 50;

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; page?: string }> }) {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const sp = await searchParams;
  const { t, locale } = await getDictionary();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.action ? { action: { contains: sp.action.slice(0, 60) } } : {}),
    ...(sp.entity ? { entityType: sp.entity.slice(0, 40) } : {}),
  };
  const [total, logs, types] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true, role: true } } } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } }),
  ]);
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`;
  return (
    <div>
      <PageHeader title={`${t.admin.audit} (${total})`} />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" role="search">
          <label className="text-sm font-medium">Action<input name="action" defaultValue={sp.action} placeholder="admin., auth.login, request." className={inputClass + " mt-1.5"} /></label>
          <label className="text-sm font-medium">Entity
            <select name="entity" defaultValue={sp.entity ?? ""} className={inputClass + " mt-1.5"}>
              <option value="">{t.common.all}</option>
              {types.map((x) => <option key={x.entityType} value={x.entityType}>{x.entityType}</option>)}
            </select>
          </label>
          <button className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-white">{t.common.filter}</button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-left text-muted"><tr><th className="px-4 py-2.5 font-medium">{t.common.time}</th><th className="px-2 font-medium">Actor</th><th className="px-2 font-medium">Action</th><th className="px-2 font-medium">Entity</th><th className="px-4 font-medium">Details</th></tr></thead>
          <tbody className="divide-y divide-border">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(l.createdAt, locale)}</td>
                <td className="px-2 py-2">{l.actor ? `${l.actor.name} (${l.actor.role})` : "system"}</td>
                <td className="px-2 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-2 py-2 text-xs">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(-8)}` : ""}</td>
                <td className="max-w-xs break-all px-4 py-2 font-mono text-[11px] text-muted">{l.meta}{l.ip ? ` · ip ${l.ip}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={qs} labels={{ prev: t.common.prev, next: t.common.next, page: t.common.page, of: t.common.of }} />
    </div>
  );
}
