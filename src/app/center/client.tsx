"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { BLOOD_GROUPS, bloodLabel } from "@/lib/blood";
import { Badge, Button, cx } from "@/components/ui";
import { SelectField, TextField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

type Row = { id: string; time: string; status: string; isWalkIn: boolean; donorId: string; donorName: string; donorPhone: string; bloodGroup: string; recorded: boolean };

export function AppointmentRow({ a, centerId }: { a: Row; centerId: string }) {
  const { t } = useI18n();
  const status = useAction();
  const record = useAction();
  const [group, setGroup] = useState(a.bloodGroup);
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 font-mono text-sm">{a.time}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{a.donorName}</span>
          <a href={`tel:${a.donorPhone}`} className="text-xs text-muted">{a.donorPhone}</a>
        </span>
        <Badge tone="primary">{bloodLabel(a.bloodGroup)}</Badge>
        <Badge tone={a.status === "CHECKED_IN" ? "success" : a.status === "COMPLETED" ? "success" : a.status === "BOOKED" ? "info" : "neutral"}>{t.appointmentStatus[a.status as keyof typeof t.appointmentStatus]}</Badge>
        {a.isWalkIn && <Badge>Walk-in</Badge>}
      </div>
      {a.status !== "COMPLETED" && a.status !== "CANCELLED" && a.status !== "NO_SHOW" && (
        <div className="mt-2 flex flex-wrap gap-2 pl-16">
          {a.status === "BOOKED" && (
            <Button size="sm" variant="outline" loading={status.pending} onClick={() => status.run(`/api/appointments/${a.id}/status`, { body: { status: "CHECKED_IN" }, success: t.common.success })}>
              {t.staff.checkIn}
            </Button>
          )}
          <Button size="sm" variant="success" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {t.staff.recordDonation}
          </Button>
          <Button size="sm" variant="ghost" loading={status.pending} onClick={() => status.run(`/api/appointments/${a.id}/status`, { body: { status: "NO_SHOW" }, success: t.common.success })}>
            {t.staff.noShow}
          </Button>
        </div>
      )}
      {open && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-3 pl-16"
          onSubmit={(e) => {
            e.preventDefault();
            record.run("/api/donations", { body: { appointmentId: a.id, donorId: a.donorId, centerId, bloodGroup: group, volumeMl: 450 }, success: t.staff.recorded, onSuccess: () => setOpen(false) });
          }}
        >
          <SelectField className="w-32" label={t.common.bloodGroup} name="bloodGroup" value={group} onChange={(e) => setGroup(e.target.value)} options={BLOOD_GROUPS.map((g) => ({ value: g, label: bloodLabel(g) }))} />
          <Button type="submit" variant="success" loading={record.pending}>{t.common.confirm}</Button>
        </form>
      )}
    </li>
  );
}

export function WalkInForm({ centerId }: { centerId: string }) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const { run, pending, error } = useAction<{ donor: string }>();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run("/api/staff/walk-in", { body: { identifier, centerId }, success: t.common.success, onSuccess: () => setIdentifier("") });
      }}
    >
      <TextField className="min-w-56 flex-1" label={t.staff.findDonor} name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={error?.code === "NOT_FOUND" ? error.message : undefined} />
      <Button type="submit" variant="outline" loading={pending}>{t.staff.walkIn}</Button>
    </form>
  );
}

export function CenterStatusForm({ centerId, statusOverride, needed }: { centerId: string; statusOverride: string; needed: string[] }) {
  const { t } = useI18n();
  const [s, setS] = useState(statusOverride);
  const [groups, setGroups] = useState<string[]>(needed);
  const { run, pending } = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(`/api/centers/${centerId}`, { method: "PATCH", body: { statusOverride: s, neededBloodGroups: groups }, success: t.common.saved });
      }}
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.staff.centerStatus}>
        {(["AUTO", "OPEN", "FULL", "CLOSED"] as const).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={s === o} onClick={() => setS(o)} className={cx("min-h-11 rounded-xl border text-sm font-semibold", s === o ? "border-primary bg-primary text-white" : "border-border")}>
            {t.staff[`status${o}`]}
          </button>
        ))}
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t.centers.needed}</legend>
        <div className="grid grid-cols-4 gap-2">
          {BLOOD_GROUPS.map((g) => {
            const on = groups.includes(g);
            return (
              <button key={g} type="button" aria-pressed={on} onClick={() => setGroups((x) => (on ? x.filter((y) => y !== g) : [...x, g]))} className={cx("min-h-10 rounded-lg border text-sm font-bold", on ? "border-primary bg-primary-soft text-primary" : "border-border")}>
                {bloodLabel(g)}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function InventoryForm({ centerId }: { centerId: string }) {
  const { t } = useI18n();
  const [f, setF] = useState({ bloodGroup: "O_POS", units: "1", mode: "ADD", note: "" });
  const { run, pending, errors } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[8rem_7rem_10rem_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run("/api/inventory", { body: { centerId, ...f, note: f.note || undefined }, success: t.common.saved });
      }}
    >
      <SelectField label={t.common.bloodGroup} name="bloodGroup" value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })} options={BLOOD_GROUPS.map((g) => ({ value: g, label: bloodLabel(g) }))} />
      <TextField label={t.common.units} name="units" type="number" min={1} max={500} value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} error={errors.units} />
      <SelectField label={t.inventory.adjust} name="mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[{ value: "ADD", label: t.inventory.add }, { value: "ISSUE", label: t.inventory.issue }, { value: "DISCARD", label: t.inventory.discard }]} />
      <TextField label={t.common.note} name="note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} />
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function MarkExpired({ batchId }: { batchId: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="ghost" className="text-danger" loading={pending} onClick={() => run("/api/inventory/expire", { body: { batchIds: [batchId] }, success: t.common.success })}>
      {t.inventory.markExpired}
    </Button>
  );
}
