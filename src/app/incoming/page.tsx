import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { locationMap } from "@/server/services/locations";
import { bloodLabel } from "@/lib/blood";
import { formatDateTime, relativeTime } from "@/lib/time";
import { isActive } from "@/lib/lifecycle";
import { AlertIcon, Badge, BloodBadge, Card, EmptyState, cx, priorityTone } from "@/components/ui";
import { AutoRefresh } from "@/components/client/auto-refresh";
import { RespondButtons } from "@/app/requests/[id]/client";

export const metadata: Metadata = { title: "Requests for me", robots: { index: false } };

export default async function IncomingPage() {
  const user = await requirePageUser();
  const { t, locale } = await getDictionary();
  const [rows, locs] = await Promise.all([
    db.donationRequest.findMany({
      where: { donorId: user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: { bloodRequest: { select: { id: true, bloodGroup: true, units: true, hospitalName: true, locationId: true, neededAt: true, priority: true, status: true } } },
    }),
    locationMap(),
  ]);
  const pending = rows.filter((r) => r.status === "PENDING" && isActive(r.bloodRequest.status));
  const others = rows.filter((r) => !pending.includes(r));

  const item = (dr: (typeof rows)[number], respond: boolean) => {
    const r = dr.bloodRequest;
    const emergency = r.priority === "EMERGENCY";
    return (
      <li key={dr.id}>
        <Card className={cx(emergency && respond && "border-danger/50")}>
          {emergency && respond && (
            <p className="-mx-4 -mt-4 mb-3 flex items-center gap-2 rounded-t-2xl bg-danger px-4 py-1.5 text-xs font-bold text-white sm:-mx-5 sm:-mt-5">
              <AlertIcon className="size-4" /> {t.request.emergencyBanner}
            </p>
          )}
          <Link href={`/requests/${r.id}`} className="flex items-start gap-3">
            <BloodBadge group={r.bloodGroup} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{bloodLabel(r.bloodGroup)} · {r.hospitalName}</p>
              <p className="text-sm text-muted">{locs.get(r.locationId)?.name} · {formatDateTime(r.neededAt, locale)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone={priorityTone[r.priority]}>{t.priority[r.priority as keyof typeof t.priority]}</Badge>
                <Badge tone={dr.status === "ACCEPTED" || dr.status === "DONATED" ? "success" : dr.status === "PENDING" ? "warning" : "neutral"}>{t.donationRequestStatus[dr.status as keyof typeof t.donationRequestStatus]}</Badge>
                {dr.distanceKm != null && <Badge>{fmt(t.incoming.distance, { km: dr.distanceKm })}</Badge>}
              </div>
              {dr.message && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">{dr.message}</p>}
            </div>
            <span className="text-xs text-muted">{relativeTime(dr.createdAt, locale)}</span>
          </Link>
          {respond && (
            <div className="mt-3">
              <RespondButtons id={dr.id} />
            </div>
          )}
        </Card>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">{t.incoming.title}</h1>
      <AutoRefresh seconds={20} />
      {rows.length === 0 ? (
        <EmptyState title={t.incoming.empty} />
      ) : (
        <>
          {pending.length > 0 && <ul className="mb-6 space-y-3">{pending.map((d) => item(d, true))}</ul>}
          {others.length > 0 && <ul className="space-y-3 opacity-90">{others.map((d) => item(d, false))}</ul>}
        </>
      )}
      <p className="mt-6 text-xs text-muted">{t.incoming.beforeYouGo}</p>
    </div>
  );
}
