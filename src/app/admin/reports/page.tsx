import { requirePageUser } from "@/server/auth/guard";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { ReportActions } from "./actions";

export const metadata = { title: "Reports" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePageUser("ADMIN"); // pages re-check: layouts are not re-run on client navigation
  const sp = await searchParams;
  const { t, locale } = await getDictionary();
  const open = sp.tab !== "closed";
  const reports = await db.report.findMany({
    where: { status: open ? { in: ["PENDING", "REVIEWING"] } : { in: ["RESOLVED", "DISMISSED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true, status: true, warnings: true, _count: { select: { reportsAgainst: true } } } },
      bloodRequest: { select: { id: true, hospitalName: true, requester: { select: { name: true } } } },
      resolvedBy: { select: { name: true } },
    },
  });
  return (
    <div>
      <PageHeader title={t.admin.reports} />
      <div className="mb-4 flex gap-2">
        {[["open", t.request.active], ["closed", t.request.completed]].map(([k, l]) => (
          <Link key={k} href={`/admin/reports?tab=${k}`} className={cx("rounded-full px-4 py-2 text-sm font-medium", (k === "open") === open ? "bg-fg text-bg" : "bg-surface-2")}>{l}</Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <EmptyState title={t.common.noResults} />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="danger">{t.report.reasons[r.reason]}</Badge>
                      <Badge tone={r.status === "PENDING" ? "warning" : r.status === "REVIEWING" ? "info" : "neutral"}>{r.status}</Badge>
                      {r.action !== "NONE" && <Badge>{r.action}</Badge>}
                    </div>
                    <p className="mt-2 text-sm">
                      {r.targetUser ? (
                        <>User: <span className="font-semibold">{r.targetUser.name}</span> ({r.targetUser.email}) · {r.targetUser.status} · ⚑ {r.targetUser._count.reportsAgainst} · ⚠ {r.targetUser.warnings}</>
                      ) : r.bloodRequest ? (
                        <>Request: <Link className="font-semibold text-primary" href={`/requests/${r.bloodRequest.id}`}>{r.bloodRequest.hospitalName}</Link> by {r.bloodRequest.requester.name}</>
                      ) : null}
                    </p>
                    {r.details && <p className="mt-1 rounded-lg bg-surface-2 p-2 text-sm">{r.details}</p>}
                    <p className="mt-1 text-xs text-muted">{r.reporter.name} · {formatDateTime(r.createdAt, locale)}</p>
                    {r.adminNote && <p className="mt-1 text-xs">Note: {r.adminNote} {r.resolvedBy && `— ${r.resolvedBy.name}`}</p>}
                  </div>
                  {open && <ReportActions id={r.id} status={r.status} />}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
