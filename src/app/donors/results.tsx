"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n";
import { bloodLabel } from "@/lib/blood";
import { Badge, BloodBadge, Button, Card, CheckIcon, LinkButton, MapPinIcon, cx } from "@/components/ui";
import { SelectField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";
import type { PublicDonor } from "@/server/services/donors";

type MyReq = { id: string; bloodGroup: string; hospitalName: string; priority: string };

export function DonorResults({ donors, signedIn, myRequests }: { donors: PublicDonor[]; signedIn: boolean; myRequests: MyReq[] }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(myRequests[0]?.id ?? "");
  const { run, pending } = useAction<{ sent: number; skipped: number }>();
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 20)));

  const send = async (ids: string[]) => {
    if (!requestId) return;
    const r = await run(`/api/requests/${requestId}/donors`, { body: { donorIds: ids }, success: t.search.sent });
    if (r) setSelected([]);
  };

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {donors.map((d) => {
          const isSel = selected.includes(d.id);
          return (
            <li key={d.id}>
              <Card className={cx("flex items-start gap-3", isSel && "border-primary ring-1 ring-primary/30")}>
                <BloodBadge group={d.bloodGroup} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {d.displayName} {d.verified && <CheckIcon className="inline size-4 text-success" aria-label={t.common.verified} />}
                  </p>
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-primary">{bloodLabel(d.bloodGroup)}</span>
                    <span className="mx-1.5">·</span>
                    <MapPinIcon className="inline size-3.5" /> {locale === "bn" ? d.areaBn : d.area}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={d.eligibleNow ? "success" : "warning"}>{d.eligibleNow ? t.availability.AVAILABLE : t.availability.TEMP_UNAVAILABLE}</Badge>
                    {d.emergencyAvailable && <Badge tone="danger">{t.availability.emergency}</Badge>}
                    {d.recentlyActive && <Badge tone="info">{t.availability.recentlyActive}</Badge>}
                  </div>
                </div>
                <div className="shrink-0">
                  {!signedIn ? (
                    <LinkButton href="/login?next=/donors" size="sm" variant="outline">{t.search.requestBlood}</LinkButton>
                  ) : myRequests.length === 0 ? (
                    <LinkButton href="/requests/new" size="sm" variant="outline">{t.search.requestBlood}</LinkButton>
                  ) : (
                    <Button size="sm" variant={isSel ? "primary" : "outline"} onClick={() => toggle(d.id)} aria-pressed={isSel} disabled={!d.eligibleNow}>
                      {isSel ? <CheckIcon className="size-4" /> : null}
                      {t.search.requestBlood}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {signedIn && myRequests.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          {t.search.noActiveRequest} <Link className="font-semibold text-primary" href="/requests/new">{t.request.newTitle}</Link>
        </p>
      )}
      {selected.length > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-3 shadow-2xl md:bottom-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {myRequests.length > 1 ? (
              <SelectField
                className="flex-1"
                label={t.search.pickRequest}
                name="requestId"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                options={myRequests.map((r) => ({ value: r.id, label: `${bloodLabel(r.bloodGroup)} · ${r.hospitalName} · ${t.priority[r.priority as keyof typeof t.priority]}` }))}
              />
            ) : (
              <p className="flex-1 text-sm">
                {bloodLabel(myRequests[0].bloodGroup)} · {myRequests[0].hospitalName}
              </p>
            )}
            <Button size="lg" loading={pending} onClick={() => send(selected)}>
              {fmt(t.search.requestSelected, { n: selected.length })}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
