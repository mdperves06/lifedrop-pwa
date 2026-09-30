import { requirePageUser } from "@/server/auth/guard";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { locationMap } from "@/server/services/locations";
import { bloodLabel } from "@/lib/blood";
import { REQUEST_STATUSES } from "@/lib/lifecycle";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, PageHeader, Pagination, inputClass, priorityTone, requestStatusTone } from "@/components/ui";

export const metadata = { title: "Requests" };
const PAGE = 25;

export default async function AdminRequests({ searchParams }: { searchParams: Promise<{ status?: string; priority?: string; q?: string; page?: string }> }) {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const sp = await searchParams;
  const { t, locale } = await getDictionary();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.BloodRequestWhereInput = {
    ...(sp.status && (REQUEST_STATUSES as readonly string[]).includes(sp.status) ? { status: sp.status as never } : {}),
    ...(sp.priority && ["NORMAL", "URGENT", "EMERGENCY"].includes(sp.priority) ? { priority: sp.priority as never } : {}),
    ...(sp.q ? { OR: [{ hospitalName: { contains: sp.q.slice(0, 80) } }, { patientName: { contains: sp.q.slice(0, 80) } }] } : {}),
  };
  const [total, rows, locs, byStatus] = await Promise.all([
    db.bloodRequest.count({ where }),
    db.bloodRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { requester: { select: { name: true } }, _count: { select: { donationRequests: true, reports: true } }, donationRequests: { where: { status: { in: ["ACCEPTED", "DONATED"] } }, select: { id: true } } },
    }),
    locationMap(),
    db.bloodRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const qs = (p: number) => `/admin/requests?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`;
  return (
    <div>
      <PageHeader title={`${t.admin.requests} (${total})`} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {byStatus.map((s) => (
          <Link key={s.status} href={`/admin/requests?status=${s.status}`}><Badge tone={requestStatusTone[s.status]} className="text-sm">{t.requestStatus[s.status]} · {s._count._all}</Badge></Link>
        ))}
      </div>
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_11rem_11rem_auto] sm:items-end" role="search">
          <label className="text-sm font-medium">{t.common.search}<input name="q" defaultValue={sp.q} className={inputClass + " mt-1.5"} placeholder={t.request.hospitalName} /></label>
          <label className="text-sm font-medium">{t.common.status}
            <select name="status" defaultValue={sp.status ?? ""} className={inputClass + " mt-1.5"}>
              <option value="">{t.common.all}</option>
              {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{t.requestStatus[s]}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">{t.request.priority}
            <select name="priority" defaultValue={sp.priority ?? ""} className={inputClass + " mt-1.5"}>
              <option value="">{t.common.all}</option>
              {(["NORMAL", "URGENT", "EMERGENCY"] as const).map((s) => <option key={s} value={s}>{t.priority[s]}</option>)}
            </select>
          </label>
          <button className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-white">{t.common.filter}</button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t.common.bloodGroup}</th>
              <th className="px-2 font-medium">{t.request.hospital}</th>
              <th className="px-2 font-medium">{t.request.requester}</th>
              <th className="px-2 font-medium">{t.common.status}</th>
              <th className="px-2 font-medium">{t.request.responses}</th>
              <th className="px-4 font-medium">{t.request.neededBy}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3"><Link href={`/requests/${r.id}`} className="font-bold text-primary">{bloodLabel(r.bloodGroup)} × {r.units}</Link></td>
                <td className="px-2 py-3"><p className="font-medium">{r.hospitalName}</p><p className="text-xs text-muted">{locs.get(r.locationId)?.name}</p></td>
                <td className="px-2 py-3">{r.requester.name}</td>
                <td className="px-2 py-3"><div className="flex flex-wrap gap-1"><Badge tone={priorityTone[r.priority]}>{t.priority[r.priority]}</Badge><Badge tone={requestStatusTone[r.status]}>{t.requestStatus[r.status]}</Badge>{r._count.reports > 0 && <Badge tone="danger">⚑ {r._count.reports}</Badge>}</div></td>
                <td className="px-2 py-3">{r.donationRequests.length}/{r._count.donationRequests}</td>
                <td className="px-4 py-3 text-xs">{formatDateTime(r.neededAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={qs} labels={{ prev: t.common.prev, next: t.common.next, page: t.common.page, of: t.common.of }} />
    </div>
  );
}
