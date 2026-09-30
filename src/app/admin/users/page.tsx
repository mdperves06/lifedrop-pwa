import { requirePageUser } from "@/server/auth/guard";
import type { Prisma } from "@prisma/client";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { bloodLabel } from "@/lib/blood";
import { formatDate } from "@/lib/time";
import { Badge, Card, PageHeader, Pagination, inputClass } from "@/components/ui";
import { UserActions } from "./actions";

export const metadata = { title: "Users" };
const PAGE = 25;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; donors?: string; page?: string }> }) {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const sp = await searchParams;
  const { t, locale } = await getDictionary();
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 80);
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] } : {}),
    ...(sp.role && ["DONOR", "CENTER_STAFF", "HOSPITAL", "ADMIN"].includes(sp.role) ? { role: sp.role as never } : {}),
    ...(sp.status && ["ACTIVE", "SUSPENDED", "REMOVED"].includes(sp.status) ? { status: sp.status as never } : {}),
    ...(sp.donors === "1" ? { donorProfile: { isNot: null } } : {}),
  };
  const [total, users, centers, hospitals] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, warnings: true, isDemo: true, centerId: true, hospitalId: true,
        donorProfile: { select: { bloodGroup: true, availability: true } },
        _count: { select: { reportsAgainst: true, donations: true } },
      },
    }),
    db.center.findMany({ select: { id: true, name: true } }),
    db.hospital.findMany({ select: { id: true, name: true } }),
  ]);
  const qs = (p: number) => `/admin/users?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(p) })}`;

  return (
    <div>
      <PageHeader title={`${t.admin.users} (${total})`} />
      <Card className="mb-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto_auto] sm:items-end" role="search">
          <label className="text-sm font-medium">{t.common.search}<input name="q" defaultValue={q} className={inputClass + " mt-1.5"} placeholder={`${t.common.name}, ${t.common.email}, ${t.common.phone}`} /></label>
          <label className="text-sm font-medium">{t.admin.role}
            <select name="role" defaultValue={sp.role ?? ""} className={inputClass + " mt-1.5"}>
              <option value="">{t.common.all}</option>
              {["DONOR", "CENTER_STAFF", "HOSPITAL", "ADMIN"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">{t.common.status}
            <select name="status" defaultValue={sp.status ?? ""} className={inputClass + " mt-1.5"}>
              <option value="">{t.common.all}</option>
              {["ACTIVE", "SUSPENDED", "REMOVED"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="donors" value="1" defaultChecked={sp.donors === "1"} className="size-5" /> {t.admin.donors}</label>
          <button className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-white">{t.common.filter}</button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t.common.name}</th>
              <th className="px-2 font-medium">{t.common.bloodGroup}</th>
              <th className="px-2 font-medium">{t.admin.role}</th>
              <th className="px-2 font-medium">{t.common.status}</th>
              <th className="px-2 font-medium">{t.admin.reports}</th>
              <th className="px-2 font-medium">{t.common.date}</th>
              <th className="px-4 font-medium">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.name} {u.isDemo && <Badge className="ml-1">{t.app.demoBadge}</Badge>}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                  <p className="text-xs text-muted">{u.phone} {u.emailVerifiedAt || u.phoneVerifiedAt ? <Badge tone="success">{t.common.verified}</Badge> : <Badge tone="warning">{t.common.unverified}</Badge>}</p>
                </td>
                <td className="px-2 py-3">{u.donorProfile ? <><Badge tone="primary">{bloodLabel(u.donorProfile.bloodGroup)}</Badge><p className="mt-1 text-xs text-muted">{t.availability[u.donorProfile.availability]}</p></> : "—"}</td>
                <td className="px-2 py-3"><Badge>{u.role}</Badge></td>
                <td className="px-2 py-3"><Badge tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "warning" : "danger"}>{u.status}</Badge>{u.warnings > 0 && <p className="mt-1 text-xs text-warning">⚠ {u.warnings}</p>}</td>
                <td className="px-2 py-3">{u._count.reportsAgainst}</td>
                <td className="px-2 py-3 text-xs">{formatDate(u.createdAt, locale)}</td>
                <td className="px-4 py-3"><UserActions user={{ id: u.id, role: u.role, status: u.status, centerId: u.centerId, hospitalId: u.hospitalId, emailVerified: !!u.emailVerifiedAt }} centers={centers} hospitals={hospitals} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} hrefFor={qs} labels={{ prev: t.common.prev, next: t.common.next, page: t.common.page, of: t.common.of }} />
    </div>
  );
}
