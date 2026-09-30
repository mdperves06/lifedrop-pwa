"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { BLOOD_GROUPS, bloodLabel } from "@/lib/blood";
import { Button, Card, cx } from "@/components/ui";
import { LocationPicker, SelectField, TextArea, TextField, Toggle, type Loc } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

const TZ = "+06:00";
const toLocalInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 6 * 3_600_000);
  return d.toISOString().slice(0, 16);
};

export function ExpirySweep() {
  const { t } = useI18n();
  const { run, pending } = useAction<{ expiredUnits: number }>();
  return (
    <Button variant="outline" loading={pending} onClick={() => run("/api/inventory/expire", { body: {}, success: t.common.success })}>
      {t.inventory.markExpired}
    </Button>
  );
}

export function AdminInventoryForm({ centers }: { centers: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [f, setF] = useState({ centerId: centers[0]?.id ?? "", bloodGroup: "O_POS", units: "1", mode: "ADD", note: "" });
  const { run, pending, errors } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_7rem_6rem_9rem_1fr_auto] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run("/api/inventory", { body: { ...f, note: f.note || undefined }, success: t.common.saved });
      }}
    >
      <SelectField label={t.dashboard.center} name="centerId" value={f.centerId} onChange={(e) => setF({ ...f, centerId: e.target.value })} options={centers.map((c) => ({ value: c.id, label: c.name }))} />
      <SelectField label={t.common.bloodGroup} name="bloodGroup" value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })} options={BLOOD_GROUPS.map((g) => ({ value: g, label: bloodLabel(g) }))} />
      <TextField label={t.common.units} name="units" type="number" min={1} value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} error={errors.units} />
      <SelectField label={t.inventory.adjust} name="mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[{ value: "ADD", label: t.inventory.add }, { value: "ISSUE", label: t.inventory.issue }, { value: "DISCARD", label: t.inventory.discard }]} />
      <TextField label={t.common.note} name="note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function CancelAppointment({ id }: { id: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="ghost" className="text-danger" loading={pending} onClick={() => {
      const reason = prompt(t.common.reason) ?? undefined;
      run(`/api/appointments/${id}`, { method: "DELETE", body: { reason }, success: t.common.success });
    }}>
      {t.common.cancel}
    </Button>
  );
}

type Campaign = { id?: string; title: string; description: string; venue: string; locationId?: string; centerId: string | null; startsAt: string; endsAt: string; targetDonors: number; status: string };

export function CampaignForm({ initial, centers, locations, onDone }: { initial?: Campaign; centers: { id: string; name: string }[]; locations: Loc[]; onDone?: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState(() => {
    const now = new Date(new Date().getTime() + 7 * 86_400_000).toISOString();
    return {
    title: initial?.title ?? "", description: initial?.description ?? "", venue: initial?.venue ?? "", loc: { areaId: initial?.locationId } as { divisionId?: string; districtId?: string; areaId?: string },
    centerId: initial?.centerId ?? "", startsAt: toLocalInput(initial?.startsAt ?? now), endsAt: toLocalInput(initial?.endsAt ?? new Date(Date.parse(now) + 8 * 3_600_000).toISOString()),
    targetDonors: String(initial?.targetDonors ?? 50), status: initial?.status ?? "PLANNED",
    };
  });
  const { run, pending, errors } = useAction();
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const body = { title: f.title, description: f.description, venue: f.venue, locationId: f.loc.areaId ?? "", centerId: f.centerId || null, startsAt: `${f.startsAt}:00${TZ}`, endsAt: `${f.endsAt}:00${TZ}`, targetDonors: f.targetDonors, status: f.status };
        run(initial?.id ? `/api/admin/campaigns/${initial.id}` : "/api/admin/campaigns", { method: initial?.id ? "PATCH" : "POST", body, success: t.common.saved, onSuccess: onDone });
      }}
    >
      <TextField label="Title" name="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} required />
      <TextArea label="Description" name="description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={errors.description} />
      <TextField label="Venue" name="venue" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} error={errors.venue} required />
      <LocationPicker value={f.loc} onChange={(v) => setF({ ...f, loc: v })} error={errors.locationId} initialLocations={locations} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Starts" name="startsAt" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} error={errors.startsAt} />
        <TextField label="Ends" name="endsAt" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} error={errors.endsAt} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField label={t.dashboard.center} name="centerId" value={f.centerId} onChange={(e) => setF({ ...f, centerId: e.target.value })} placeholder="—" options={centers.map((c) => ({ value: c.id, label: c.name }))} />
        <TextField label="Target donors" name="targetDonors" type="number" min={1} value={f.targetDonors} onChange={(e) => setF({ ...f, targetDonors: e.target.value })} error={errors.targetDonors} />
        <SelectField label={t.common.status} name="status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"].map((s) => ({ value: s, label: s }))} />
      </div>
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant={open ? "secondary" : "primary"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "×" : "+"} {label}</Button>
      {open && <Card className="mt-3">{children}</Card>}
    </div>
  );
}

export function EditCampaign({ campaign, centers, locations }: { campaign: Campaign; centers: { id: string; name: string }[]; locations: Loc[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{t.common.edit}</Button>
      {open && <div className="mt-3 w-full"><CampaignForm initial={campaign} centers={centers} locations={locations} onDone={() => setOpen(false)} /></div>}
    </>
  );
}

type CenterF = { id?: string; name: string; address: string; phone: string; email: string; locationId?: string; lat: string; lng: string; openTime: string; closeTime: string; openDays: string; capacityPerSlot: string; staffCount: string; beds: string; equipment: string; neededBloodGroups: string[]; statusOverride: string; description: string; isActive: boolean };

export function CenterForm({ initial, locations, onDone }: { initial?: CenterF; locations: Loc[]; onDone?: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState<CenterF>(
    initial ?? { name: "", address: "", phone: "", email: "", lat: "23.78", lng: "90.40", openTime: "08:00", closeTime: "18:00", openDays: "0,1,2,3,4,6", capacityPerSlot: "4", staffCount: "5", beds: "4", equipment: "", neededBloodGroups: [], statusOverride: "AUTO", description: "", isActive: true },
  );
  const [loc, setLoc] = useState<{ divisionId?: string; districtId?: string; areaId?: string }>({ areaId: initial?.locationId });
  const { run, pending, errors } = useAction();
  const s = (k: keyof CenterF) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const body = { ...f, locationId: loc.areaId ?? "", email: f.email || null, description: f.description || null, equipment: f.equipment.split(",").map((x) => x.trim()).filter(Boolean) };
        delete (body as { id?: string }).id;
        run(initial?.id ? `/api/admin/centers/${initial.id}` : "/api/admin/centers", { method: initial?.id ? "PATCH" : "POST", body, success: t.common.saved, onSuccess: onDone });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t.common.name} name="name" value={f.name} onChange={s("name")} error={errors.name} />
        <TextField label={t.common.phone} name="phone" value={f.phone} onChange={s("phone")} error={errors.phone} />
      </div>
      <TextField label="Address" name="address" value={f.address} onChange={s("address")} error={errors.address} />
      <LocationPicker value={loc} onChange={setLoc} error={errors.locationId} initialLocations={locations} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TextField label="Lat" name="lat" value={f.lat} onChange={s("lat")} error={errors.lat} />
        <TextField label="Lng" name="lng" value={f.lng} onChange={s("lng")} error={errors.lng} />
        <TextField label="Open" name="openTime" type="time" value={f.openTime} onChange={s("openTime")} />
        <TextField label="Close" name="closeTime" type="time" value={f.closeTime} onChange={s("closeTime")} />
        <TextField label="Open days (0=Sun)" name="openDays" value={f.openDays} onChange={s("openDays")} error={errors.openDays} />
        <TextField label={t.centers.capacity} name="capacityPerSlot" type="number" value={f.capacityPerSlot} onChange={s("capacityPerSlot")} />
        <TextField label={t.centers.staff} name="staffCount" type="number" value={f.staffCount} onChange={s("staffCount")} />
        <TextField label={t.centers.beds} name="beds" type="number" value={f.beds} onChange={s("beds")} />
      </div>
      <TextField label={`${t.centers.equipment} (comma separated)`} name="equipment" value={f.equipment} onChange={s("equipment")} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t.centers.needed}</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {BLOOD_GROUPS.map((g) => {
            const on = f.neededBloodGroups.includes(g);
            return <button key={g} type="button" aria-pressed={on} onClick={() => setF({ ...f, neededBloodGroups: on ? f.neededBloodGroups.filter((x) => x !== g) : [...f.neededBloodGroups, g] })} className={cx("min-h-10 rounded-lg border text-sm font-bold", on ? "border-primary bg-primary-soft text-primary" : "border-border")}>{bloodLabel(g)}</button>;
          })}
        </div>
      </fieldset>
      <TextArea label="Description" name="description" value={f.description} onChange={s("description")} />
      <Toggle label={t.common.open} checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} description="Active centers appear publicly and accept bookings." />
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function EditCenter({ center, locations }: { center: CenterF; locations: Loc[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{t.common.edit}</Button>
      {open && <div className="mt-3"><CenterForm initial={center} locations={locations} onDone={() => setOpen(false)} /></div>}
    </>
  );
}

export function LocationForm({ parents }: { parents: { id: string; name: string; type: string }[] }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", nameBn: "", type: "AREA", parentId: "", lat: "", lng: "" });
  const { run, pending, errors } = useAction();
  const parentType = f.type === "AREA" ? "DISTRICT" : f.type === "DISTRICT" ? "DIVISION" : null;
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run("/api/admin/locations", { body: { name: f.name, nameBn: f.nameBn || null, type: f.type, parentId: f.parentId || null, lat: f.lat || null, lng: f.lng || null }, success: t.common.saved, onSuccess: () => setF({ ...f, name: "", nameBn: "", lat: "", lng: "" }) });
      }}
    >
      <SelectField label="Type" name="type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, parentId: "" })} options={["DIVISION", "DISTRICT", "AREA"].map((x) => ({ value: x, label: x }))} />
      {parentType && <SelectField label="Parent" name="parentId" value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} placeholder="—" error={errors.parentId} options={parents.filter((p) => p.type === parentType).map((p) => ({ value: p.id, label: p.name }))} />}
      <TextField label={`${t.common.name} (EN)`} name="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
      <TextField label={`${t.common.name} (বাংলা)`} name="nameBn" value={f.nameBn} onChange={(e) => setF({ ...f, nameBn: e.target.value })} />
      <TextField label="Lat" name="lat" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} error={errors.lat} />
      <TextField label="Lng" name="lng" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} error={errors.lng} />
      <div className="sm:col-span-3"><Button type="submit" loading={pending}>{t.common.save}</Button></div>
    </form>
  );
}

export function LocationToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(`/api/admin/locations/${id}`, { method: "PATCH", body: { isActive: !active }, success: t.common.saved })}>
      {active ? t.admin.suspend : t.admin.activate}
    </Button>
  );
}

export function AnnouncementForm() {
  const { t } = useI18n();
  const [f, setF] = useState({ title: "", message: "", audience: "ALL", push: true });
  const { run, pending, errors } = useAction<{ recipients: number }>();
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(`${t.admin.send}?`)) return;
        run("/api/admin/announcements", { body: f, success: t.common.success, onSuccess: () => setF({ ...f, title: "", message: "" }) });
      }}
    >
      <TextField label="Title" name="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={errors.title} />
      <TextArea label="Message" name="message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} error={errors.message} maxLength={1000} />
      <SelectField label={t.admin.audience} name="audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={["ALL", "DONORS", "HOSPITALS", "STAFF"].map((a) => ({ value: a, label: a }))} />
      <Toggle label={t.profile.pushTitle} checked={f.push} onChange={(v) => setF({ ...f, push: v })} />
      <Button type="submit" loading={pending}>{t.admin.send}</Button>
    </form>
  );
}

type S = Record<string, string | number>;
export function SettingsForm({ initial }: { initial: S }) {
  const { t } = useI18n();
  const [f, setF] = useState<S>(initial);
  const { run, pending, errors } = useAction();
  const labels: Record<string, string> = {
    cityName: "City name",
    donationIntervalDays: "Donation interval (days)",
    emergencyRadiusKm: "Emergency alert radius (km)",
    maxAutoNotify: "Max donors auto-notified per request",
    lowStockUnits: "Low stock threshold (units, city-wide)",
    criticalStockUnits: "Critical stock threshold (units, city-wide)",
    dailyDonationTarget: "Daily donation target (city)",
    batchShelfLifeDays: "Blood unit shelf life (days)",
    requestExpiryHours: "Expire requests after needed time (hours)",
    hotlinePhone: "Emergency hotline number",
    maxOpenRequestsUnverified: "Max active requests for unverified users",
  };
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof initial[k] === "number" ? Number(v) : v]));
        run("/api/admin/settings", { method: "PATCH", body, success: t.common.saved });
      }}
    >
      {Object.keys(initial).map((k) => (
        <TextField key={k} label={labels[k] ?? k} name={k} type={typeof initial[k] === "number" ? "number" : "text"} step="any" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} error={errors[k]} />
      ))}
      <div className="sm:col-span-2"><Button type="submit" loading={pending}>{t.common.save}</Button></div>
    </form>
  );
}
