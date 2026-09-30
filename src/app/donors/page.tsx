import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { fmt, formatNumber } from "@/i18n";
import { getSessionUser } from "@/server/auth/session";
import { searchDonors } from "@/server/services/donors";
import { allLocations } from "@/server/services/locations";
import { db } from "@/server/db";
import { donorSearchSchema } from "@/lib/validation";
import { bloodLabel } from "@/lib/blood";
import { ACTIVE_STATUSES } from "@/lib/lifecycle";
import { EmptyState, LinkButton, PageHeader, Pagination, Alert } from "@/components/ui";
import { DonorFilters } from "./filters";
import { DonorResults } from "./results";

export const metadata: Metadata = { title: "Find blood donors", robots: { index: false } };

export default async function DonorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const parsed = donorSearchSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : { page: 1 };
  const [{ t, locale }, viewer, locs] = await Promise.all([getDictionary(), getSessionUser(), allLocations()]);
  const filters = {
    bloodGroup: "bloodGroup" in q ? q.bloodGroup : undefined,
    compatible: "compatible" in q && q.compatible === "1",
    divisionId: "divisionId" in q ? q.divisionId : undefined,
    districtId: "districtId" in q ? q.districtId : undefined,
    areaId: "areaId" in q ? q.areaId : undefined,
    availableNow: !("availableNow" in q) || q.availableNow !== "0",
    emergency: "emergency" in q && q.emergency === "1",
    recentlyActive: "recentlyActive" in q && q.recentlyActive === "1",
    page: q.page,
  };
  const result = await searchDonors(filters, { signedIn: !!viewer, userId: viewer?.id });
  const myRequests = viewer
    ? await db.bloodRequest.findMany({
        where: { requesterId: viewer.id, status: { in: ACTIVE_STATUSES } },
        select: { id: true, bloodGroup: true, hospitalName: true, priority: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const qs = (p: number) => {
    const s = new URLSearchParams(Object.entries(raw).filter(([k, v]) => v && k !== "page") as [string, string][]);
    s.set("page", String(p));
    return `/donors?${s}`;
  };

  return (
    <div>
      <PageHeader title={t.search.title} subtitle={t.search.subtitle} />
      <DonorFilters
        initial={{ ...filters, availableNow: filters.availableNow }}
        locations={locs.map(({ id, name, nameBn, type, parentId }) => ({ id, name, nameBn, type, parentId }))}
      />
      <div className="mt-6">
        {!parsed.success && <Alert tone="warning" className="mb-4">{t.common.errorGeneric}</Alert>}
        <p className="mb-3 text-sm font-medium text-muted" aria-live="polite">{fmt(t.search.results, { n: formatNumber(result.total, locale) })}</p>
        {result.donors.length === 0 ? (
          <EmptyState
            title={fmt(t.search.empty, { group: filters.bloodGroup ? bloodLabel(filters.bloodGroup) : "" }).replace("  ", " ")}
            body={t.search.emptyHint}
            action={<LinkButton href="/requests/new">{t.search.requestBlood}</LinkButton>}
          />
        ) : (
          <DonorResults donors={result.donors} signedIn={!!viewer} myRequests={myRequests} />
        )}
        <Pagination page={result.page} pages={result.pages} hrefFor={qs} labels={{ prev: t.common.prev, next: t.common.next, page: t.common.page, of: t.common.of }} />
      </div>
      <p className="mt-8 text-xs text-muted">{t.app.disclaimer}</p>
    </div>
  );
}
