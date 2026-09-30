"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n";
import { Alert, AlertIcon, Button, Card, cx } from "@/components/ui";
import { BloodGroupPicker, LocationPicker, SelectField, TextArea, TextField, type Loc } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";
import { useToast } from "@/components/client/toast";
import { localDateKey, localParts } from "@/lib/time";

type Defaults = { priority: "NORMAL" | "URGENT" | "EMERGENCY"; bloodGroup: string; hospitalName: string; hospitalAddress: string; hospitalId: string | null; areaId?: string; contactPhone: string };

export function RequestForm({ locations, defaults }: { locations: Loc[]; defaults: Defaults }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const now = new Date();
  const soon = new Date(now.getTime() + (defaults.priority === "EMERGENCY" ? 2 : defaults.priority === "URGENT" ? 12 : 48) * 3_600_000);
  const p = localParts(soon);
  const [f, setF] = useState({
    bloodGroup: defaults.bloodGroup,
    units: "1",
    patientName: "",
    hospitalName: defaults.hospitalName,
    hospitalAddress: defaults.hospitalAddress,
    loc: { areaId: defaults.areaId } as { divisionId?: string; districtId?: string; areaId?: string },
    date: localDateKey(soon),
    time: `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`,
    priority: defaults.priority,
    notes: "",
    contactPreference: "BOTH",
    contactPhone: defaults.contactPhone,
  });
  const [dup, setDup] = useState<string | null>(null);
  const { run, pending, errors } = useAction<{ id: string; status: string; autoNotified: number }>();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (draft: boolean) => {
    setDup(null);
    const tz = process.env.NEXT_PUBLIC_TZ_OFFSET_MINUTES ?? "360";
    const off = Number(tz);
    const sign = off >= 0 ? "+" : "-";
    const iso = `${f.date}T${f.time || "00:00"}:00${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
    const data = await run("/api/requests", {
      body: {
        bloodGroup: f.bloodGroup, units: f.units, patientName: f.patientName, hospitalName: f.hospitalName, hospitalAddress: f.hospitalAddress || null,
        hospitalId: defaults.hospitalId, locationId: f.loc.areaId ?? "", neededAt: iso, priority: f.priority, notes: f.notes || null,
        contactPreference: f.contactPreference, contactPhone: f.contactPreference === "IN_APP" ? null : f.contactPhone || null, saveAsDraft: draft,
      },
      refresh: false,
      silent: true,
      onError: (e) => {
        if (e.code === "DUPLICATE_REQUEST") setDup((e.details as { requestId?: string })?.requestId ?? null);
        else toast("error", e.message);
      },
    });
    if (data) {
      toast("success", data.autoNotified ? `${t.request.posted} ${fmt(t.request.autoNotified, { n: data.autoNotified })}` : t.request.posted);
      router.push(`/requests/${data.id}`);
      router.refresh();
    }
  };

  const emergency = f.priority === "EMERGENCY";
  return (
    <Card className={cx(emergency && "border-danger/50")}>
      {emergency && (
        <p className="-mx-4 -mt-4 mb-4 flex items-center gap-2 rounded-t-2xl bg-danger px-4 py-2 text-sm font-bold tracking-wide text-white sm:-mx-5 sm:-mt-5">
          <AlertIcon className="size-4" /> {t.request.emergencyBanner}
        </p>
      )}
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        {dup && (
          <Alert tone="warning" title={t.request.duplicate}>
            <Link href={`/requests/${dup}`} className="font-semibold underline">{t.request.viewExisting}</Link>
          </Alert>
        )}
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t.request.priority}</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {(["NORMAL", "URGENT", "EMERGENCY"] as const).map((pr) => (
              <button
                type="button"
                key={pr}
                role="radio"
                aria-checked={f.priority === pr}
                onClick={() => set("priority", pr)}
                className={cx(
                  "min-h-12 rounded-xl border font-semibold",
                  f.priority === pr ? (pr === "EMERGENCY" ? "border-danger bg-danger text-white" : pr === "URGENT" ? "border-warning bg-warning text-white" : "border-fg bg-fg text-bg") : "border-border bg-surface",
                )}
              >
                {t.priority[pr]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{t.request.priorityHelp}</p>
        </fieldset>
        <BloodGroupPicker label={t.request.bloodGroup} value={f.bloodGroup} onChange={(v) => set("bloodGroup", v)} error={errors.bloodGroup} />
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <TextField label={t.request.units} name="units" type="number" inputMode="numeric" min={1} max={20} value={f.units} onChange={(e) => set("units", e.target.value)} error={errors.units} required />
          <TextField label={t.request.patientName} name="patientName" value={f.patientName} onChange={(e) => set("patientName", e.target.value)} error={errors.patientName} hint={t.request.patientPrivate} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.request.hospitalName} name="hospitalName" value={f.hospitalName} onChange={(e) => set("hospitalName", e.target.value)} error={errors.hospitalName} required />
          <TextField label={t.request.hospitalAddress} name="hospitalAddress" value={f.hospitalAddress} onChange={(e) => set("hospitalAddress", e.target.value)} error={errors.hospitalAddress} />
        </div>
        <LocationPicker value={f.loc} onChange={(v) => set("loc", v)} error={errors.locationId} initialLocations={locations} labels={{ area: t.request.hospitalArea }} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t.request.neededDate} name="date" type="date" min={localDateKey(now)} value={f.date} onChange={(e) => set("date", e.target.value)} error={errors.neededAt} required />
          <TextField label={t.request.neededTime} name="time" type="time" value={f.time} onChange={(e) => set("time", e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t.request.contactPreference}
            name="contactPreference"
            value={f.contactPreference}
            onChange={(e) => set("contactPreference", e.target.value)}
            options={(["IN_APP", "PHONE", "BOTH"] as const).map((c) => ({ value: c, label: t.request[`contact${c}`] }))}
          />
          {f.contactPreference !== "IN_APP" && (
            <TextField label={t.request.contactPhone} name="contactPhone" type="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} error={errors.contactPhone} required />
          )}
        </div>
        <TextArea label={`${t.request.notes} (${t.common.optional})`} name="notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes} maxLength={500} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={() => submit(true)}>{t.request.saveDraft}</Button>
          <Button type="submit" variant={emergency ? "danger" : "primary"} size="lg" loading={pending}>{pending ? t.request.posting : t.request.post}</Button>
        </div>
      </form>
    </Card>
  );
}
