import { requirePageUser } from "@/server/auth/guard";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { formatDateTime, startOfLocalDay } from "@/lib/time";
import { Badge, Card, PageHeader, Pagination, cx } from "@/components/ui";
import { CancelAppointment } from "../forms";

export const metadata = { title: "Appointments" };
const PAGE = 30;

export default async function AdminAppointments({ searchParams }: { searchParams: Promise<{ tab?: string; centerId?: string; page?: string }> }) {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const sp = await searchParams;
  const { t, locale } = await getDictionary();
  const page = Math.max(1, Number(sp.page) || 1);
  const tab = sp.tab === "past" ? "past" : "upcoming";
  const today = startOfLocalDay(new Date());
  const where: Prisma.AppointmentWhereInput = {
    ...(tab === "upcoming" ? { startsAt: { gte: today }, status: { in: ["BOOKED", "CHECKED_IN"] } } : { OR: [{ startsAt: { lt: today } }, { status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }] }),
    ...(sp.centerId ? { centerId: sp.centerId } : {}),
  };
  const [total, rows, centers] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({ where, orderBy: { startsAt: tab === "upcoming" ? "asc" : "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { donor: { select: { name: true, phone: true } }, center: { select: { name: true } } } }),
    db.center.findMany({ select: { id: true, name: true } }),
  ]);
  const qs = (p: number) => `/admin/appointments?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`;
  return (
    <div>
      <PageHeader title={`${t.admin.appointments} (${total})`} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["upcoming", "past"] as const).map((k) => (
          <Link key={k} href={`/admin/appointments?tab=${k}${sp.centerId ? `&centerId=${sp.centerId}` : ""}`} className={cx("rounded-full px-4 py-2 text-sm font-medium", tab === k ? "bg-fg text-bg" : "bg-surface-2")}>{k === "upcoming" ? t.appointments.upcoming : t.appointments.past}</Link>
        ))}
        <span className="mx-1 w-px bg-border" />
        <Link href={`/admin/appointments?tab=${tab}`} className={cx("rounded-full px-3 py-2 text-xs", !sp.centerId ? "bg-primary text-white" : "bg-surface-2")}>{t.common.all}</Link>
        {centers.map((c) => <Link key={c.id} href={`/admin/appointments?tab=${tab}&centerId=${c.id}`} className={cx("rounded-full px-3 py-2 text-xs", sp.centerId === c.id ? "bg-primary text-white" : "bg-surface-2")}>{c.name.replace(/^LifeDrop /, "").replace(/ \(Demo\)$/, "")}</Link>)}
      </div>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-2 text-left text-muted"><tr><th className="px-4 py-2.5 font-medium">{t.common.time}</th><th className="px-2 font-medium">{t.common.name}</th><th className="px-2 font-medium">{t.dashboard.center}</th><th className="px-2 font-medium">{t.common.status}</th><th className="px-4" /></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5">{formatDateTime(a.startsAt, locale)}</td>
                <td className="px-2"><p className="font-medium">{a.donor.name}</p><p className="text-xs text-muted">{a.donor.phone}</p></td>
                <td className="px-2">{a.center.name}</td>
                <td className="px-2"><Badge>{t.appointmentStatus[a.status]}</Badge>{a.isWalkIn && <Badge className="ml-1">Walk-in</Badge>}</td>
                <td className="px-4 text-right">{(a.status === "BOOKED" || a.status === "CHECKED_IN") && <CancelAppointment id={a.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={qs} labels={{ prev: t.common.prev, next: t.common.next, page: t.common.page, of: t.common.of }} />
    </div>
  );
}
