import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { locationMap } from "@/server/services/locations";
import { ACTIVE_STATUSES } from "@/lib/lifecycle";
import { EmptyState, LinkButton, PageHeader, PlusIcon, cx } from "@/components/ui";
import { RequestCard } from "@/components/blocks";
import { AutoRefresh } from "@/components/client/auto-refresh";

export const metadata: Metadata = { title: "My requests", robots: { index: false } };

const TABS = ["active", "emergency", "completed", "closed"] as const;

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageUser();
  const [{ t, locale }, sp] = await Promise.all([getDictionary(), searchParams]);
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "active";
  const scope = user.role === "HOSPITAL" && user.hospitalId ? { OR: [{ requesterId: user.id }, { hospitalId: user.hospitalId }] } : { requesterId: user.id };
  const where = {
    active: { status: { in: [...ACTIVE_STATUSES, "DRAFT" as const] } },
    emergency: { status: { in: ACTIVE_STATUSES }, priority: "EMERGENCY" as const },
    completed: { status: { in: ["FULFILLED" as const, "CLOSED" as const] } },
    closed: { status: { in: ["CANCELLED" as const, "EXPIRED" as const] } },
  }[tab];
  const [rows, counts, locs] = await Promise.all([
    db.bloodRequest.findMany({
      where: { ...scope, ...where },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: { donationRequests: { select: { status: true } } },
    }),
    db.bloodRequest.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    locationMap(),
  ]);
  const count = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count._all, 0);
  const tabLabel = { active: t.request.active, emergency: t.request.emergencyTab, completed: t.request.completed, closed: t.request.cancelledExpired };
  const tabCount = { active: count([...ACTIVE_STATUSES, "DRAFT"]), emergency: undefined, completed: count(["FULFILLED", "CLOSED"]), closed: count(["CANCELLED", "EXPIRED"]) };

  return (
    <div>
      <PageHeader title={t.nav.myRequests} actions={<LinkButton href="/requests/new"><PlusIcon className="size-4" /> {t.nav.requestBlood}</LinkButton>} />
      <nav className="-mx-4 mb-4 overflow-x-auto px-4" aria-label={t.nav.myRequests}>
        <ul className="flex gap-2">
          {TABS.map((k) => (
            <li key={k}>
              <Link href={`/my-requests?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cx("inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium", tab === k ? "bg-fg text-bg" : "bg-surface-2")}>
                {tabLabel[k]} {tabCount[k] != null && <span className="opacity-70">{tabCount[k]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "active" && rows.length > 0 && <AutoRefresh seconds={20} label={t.request.autoRefresh} />}
      {rows.length === 0 ? (
        <EmptyState title={t.request.noRequests} action={<LinkButton href="/requests/new">{t.nav.requestBlood}</LinkButton>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const a = locs.get(r.locationId);
            const accepted = r.donationRequests.filter((d) => d.status === "ACCEPTED" || d.status === "DONATED").length;
            return (
              <div key={r.id} className="relative">
                <RequestCard r={{ ...r, area: a?.name ?? "", areaBn: a?.nameBn ?? a?.name ?? "" }} t={t} locale={locale} />
                <p className="absolute bottom-4 right-5 text-xs font-medium text-muted">
                  {t.dashboard.accepted}: {accepted}/{r.donationRequests.length}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
