"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n";
import { bloodLabel, compatibleDonorGroups, type BloodGroupCode } from "@/lib/blood";
import { api } from "@/lib/api-client";
import { Badge, BloodBadge, Button, Card, CheckIcon, Spinner, cx } from "@/components/ui";
import { SelectField, TextField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

export function RequestActions({ id, status, units }: { id: string; status: string; units: number }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const act = (action: string, confirmText?: string, extra: Record<string, unknown> = {}) => {
    if (confirmText && !confirm(confirmText)) return;
    run(`/api/requests/${id}/action`, { body: { action, ...extra }, success: t.common.success });
  };
  const active = ["OPEN", "MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED"].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && <Button loading={pending} onClick={() => act("PUBLISH")}>{t.request.publish}</Button>}
      {active && (
        <Button variant="success" loading={pending} onClick={() => act("FULFILL", t.request.fulfillConfirm, { unitsFulfilled: units })}>
          <CheckIcon className="size-4" /> {t.request.fulfill}
        </Button>
      )}
      {status === "FULFILLED" && <Button variant="secondary" loading={pending} onClick={() => act("CLOSE")}>{t.request.close}</Button>}
      {status === "EXPIRED" && <Button loading={pending} onClick={() => act("REOPEN")}>{t.request.reopen}</Button>}
      {(active || status === "DRAFT") && (
        <Button variant="ghost" className="text-danger" disabled={pending} onClick={() => act("CANCEL", t.request.cancelConfirm)}>
          {t.request.cancel}
        </Button>
      )}
    </div>
  );
}

type Match = { id: string; name: string; bloodGroup: string; area: string; distanceKm: number | null; sameArea: boolean; emergencyAvailable: boolean; score: number };

export function MatchList({ id }: { id: string }) {
  const { t } = useI18n();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const { run, pending } = useAction<{ sent: number }>();

  const load = () => {
    setFailed(false);
    api<Match[]>(`/api/requests/${id}/matches`).then((r) => (r.ok ? setMatches(r.data) : setFailed(true)));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(load, [id]);

  const send = async () => {
    const r = await run(`/api/requests/${id}/donors`, { body: { donorIds: selected }, success: t.search.sent });
    if (r) {
      setSelected([]);
      load();
    }
  };

  return (
    <Card>
      <h2 className="font-bold">{t.request.matchedDonors}</h2>
      <p className="mb-3 text-xs text-muted">{t.request.matchedHint}</p>
      {failed ? (
        <div className="text-sm text-danger">
          {t.common.errorGeneric} <button className="font-semibold underline" onClick={load}>{t.common.retry}</button>
        </div>
      ) : !matches ? (
        <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" /> {t.common.loading}</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted">{t.search.emptyHint}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {matches.map((m) => {
              const sel = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <label className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2.5", sel && "bg-primary-soft")}>
                    <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={sel} onChange={() => setSelected((s) => (sel ? s.filter((x) => x !== m.id) : [...s, m.id].slice(0, 20)))} />
                    <BloodBadge group={m.bloodGroup} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.name}</span>
                      <span className="block text-sm text-muted">
                        {m.area}
                        {m.distanceKm != null && ` · ~${m.distanceKm} ${t.common.km}`}
                      </span>
                    </span>
                    {m.emergencyAvailable && <Badge tone="danger">{t.priority.EMERGENCY}</Badge>}
                  </label>
                </li>
              );
            })}
          </ul>
          <Button className="mt-3 w-full sm:w-auto" disabled={!selected.length} loading={pending} onClick={send}>
            {fmt(t.search.requestSelected, { n: selected.length })}
          </Button>
        </>
      )}
    </Card>
  );
}

export function RespondButtons({ id, onDone }: { id: string; onDone?: () => void }) {
  const { t } = useI18n();
  const accept = useAction();
  const decline = useAction();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button size="lg" variant="success" loading={accept.pending} disabled={decline.pending} onClick={() => accept.run(`/api/donation-requests/${id}/respond`, { body: { action: "ACCEPT" }, success: t.incoming.accepted, onSuccess: onDone })}>
        {accept.pending ? t.incoming.accepting : t.incoming.accept}
      </Button>
      <Button size="lg" variant="outline" loading={decline.pending} disabled={accept.pending} onClick={() => decline.run(`/api/donation-requests/${id}/respond`, { body: { action: "DECLINE" }, success: t.incoming.declined, onSuccess: onDone })}>
        {decline.pending ? t.incoming.declining : t.incoming.decline}
      </Button>
    </div>
  );
}

export function IssueStock({ requestId, bloodGroup, centers }: { requestId: string; bloodGroup: string; centers: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const groups = compatibleDonorGroups(bloodGroup as BloodGroupCode);
  const [centerId, setCenterId] = useState(centers[0]?.id ?? "");
  const [group, setGroup] = useState<string>(bloodGroup);
  const [units, setUnits] = useState("1");
  const { run, pending, errors } = useAction();
  return (
    <Card>
      <h2 className="mb-3 font-bold">{t.request.issueStock}</h2>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_8rem_6rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run("/api/inventory", { body: { centerId, bloodGroup: group, units, mode: "ISSUE", bloodRequestId: requestId }, success: t.common.success });
        }}
      >
        <SelectField label={t.dashboard.center} name="centerId" value={centerId} onChange={(e) => setCenterId(e.target.value)} options={centers.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label={t.common.bloodGroup} name="bloodGroup" value={group} onChange={(e) => setGroup(e.target.value)} options={groups.map((g) => ({ value: g, label: bloodLabel(g) }))} />
        <TextField label={t.common.units} name="units" type="number" min={1} max={20} value={units} onChange={(e) => setUnits(e.target.value)} error={errors.units} />
        <Button type="submit" loading={pending}>{t.inventory.issue}</Button>
      </form>
    </Card>
  );
}
