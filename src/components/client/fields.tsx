"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { BLOOD_GROUPS, BLOOD_LABEL } from "@/lib/blood";
import { cx, FieldError, inputClass, Label } from "@/components/ui";
import { api } from "@/lib/api-client";

export type Loc = { id: string; name: string; nameBn: string | null; type: "DIVISION" | "DISTRICT" | "AREA"; parentId: string | null };

let locCache: Promise<Loc[]> | null = null;
export function useLocations(initial?: Loc[]) {
  const [locs, setLocs] = useState<Loc[]>(initial ?? []);
  useEffect(() => {
    if (initial?.length) return;
    locCache ??= api<Loc[]>("/api/locations").then((r) => (r.ok ? r.data : []));
    let alive = true;
    locCache.then((l) => alive && setLocs(l));
    return () => {
      alive = false;
    };
  }, [initial]);
  return locs;
}

export function TextField({
  label, name, error, hint, required, className, ...rest
}: React.ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>{label}</Label>
      <input id={id} name={name} required={required} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} className={inputClass} {...rest} />
      {hint && !error && <p id={`${id}-h`} className="mt-1 text-xs text-muted">{hint}</p>}
      <FieldError id={`${id}-e`}>{error}</FieldError>
    </div>
  );
}

export function TextArea({ label, name, error, className, ...rest }: React.ComponentProps<"textarea"> & { label: string; name: string; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} name={name} rows={3} aria-invalid={!!error || undefined} className={cx(inputClass, "min-h-24")} {...rest} />
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function SelectField({
  label, name, error, options, placeholder, required, className, ...rest
}: React.ComponentProps<"select"> & { label: string; name: string; error?: string; options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>{label}</Label>
      <select id={id} name={name} required={required} aria-invalid={!!error || undefined} className={inputClass} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Toggle({ label, checked, onChange, description, disabled, name }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string; disabled?: boolean; name?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex cursor-pointer items-start gap-3 rounded-xl py-2", disabled && "opacity-60")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} name={name} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-success peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Checkbox({ label, checked, onChange, error, name }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; error?: string; name?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1.5 text-[15px]">
        <input id={id} name={name} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error || undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
        <span>{label}</span>
      </label>
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Large-touch-target blood group selector (radio group). */
export function BloodGroupPicker({ value, onChange, error, label, allowAny, anyLabel }: { value: string; onChange: (v: string) => void; error?: string; label: string; allowAny?: boolean; anyLabel?: string }) {
  const id = useId();
  const options = allowAny ? ["", ...BLOOD_GROUPS] : [...BLOOD_GROUPS];
  return (
    <fieldset>
      <legend id={id} className="mb-1.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-labelledby={id} className={cx("grid gap-2", allowAny ? "grid-cols-3 sm:grid-cols-9" : "grid-cols-4")}>
        {options.map((g) => {
          const selected = value === g;
          return (
            <button
              type="button"
              key={g || "any"}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(g)}
              className={cx(
                "min-h-12 rounded-xl border text-base font-bold transition-colors",
                selected ? "border-primary bg-primary text-white" : "border-border bg-surface hover:border-primary/60",
                !g && "text-sm font-semibold",
              )}
            >
              {g ? BLOOD_LABEL[g as keyof typeof BLOOD_LABEL] : anyLabel}
            </button>
          );
        })}
      </div>
      <FieldError>{error}</FieldError>
    </fieldset>
  );
}

/** Cascading Division → District → Area selector. */
export function LocationPicker({
  value, onChange, error, requireArea = true, initialLocations, labels, compact,
}: {
  value: { divisionId?: string; districtId?: string; areaId?: string };
  onChange: (v: { divisionId?: string; districtId?: string; areaId?: string }) => void;
  error?: string;
  requireArea?: boolean;
  initialLocations?: Loc[];
  labels?: { division?: string; district?: string; area?: string };
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const locs = useLocations(initialLocations);
  const name = (l: Loc) => (locale === "bn" && l.nameBn ? l.nameBn : l.name);
  const byId = useMemo(() => new Map(locs.map((l) => [l.id, l])), [locs]);

  // Derive parents when only an area id is known (e.g. editing a profile).
  const areaId = value.areaId;
  const districtId = value.districtId ?? (areaId ? byId.get(areaId)?.parentId ?? undefined : undefined);
  const divisionId = value.divisionId ?? (districtId ? byId.get(districtId)?.parentId ?? undefined : undefined);

  const divisions = locs.filter((l) => l.type === "DIVISION");
  const districts = locs.filter((l) => l.type === "DISTRICT" && l.parentId === divisionId);
  const areas = locs.filter((l) => l.type === "AREA" && l.parentId === districtId);
  const any = !requireArea;

  return (
    <div className={cx("grid gap-3", compact ? "sm:grid-cols-3" : "sm:grid-cols-3")}>
      <SelectField
        label={labels?.division ?? t.common.division}
        name="divisionId"
        value={divisionId ?? ""}
        onChange={(e) => onChange({ divisionId: e.target.value || undefined, districtId: undefined, areaId: undefined })}
        placeholder={any ? t.common.anyDivision : t.common.selectDivision}
        options={divisions.map((d) => ({ value: d.id, label: name(d) }))}
        required={requireArea}
      />
      <SelectField
        label={labels?.district ?? t.common.district}
        name="districtId"
        value={districtId ?? ""}
        disabled={!divisionId}
        onChange={(e) => onChange({ divisionId, districtId: e.target.value || undefined, areaId: undefined })}
        placeholder={any ? t.common.anyDistrict : t.common.selectDistrict}
        options={districts.map((d) => ({ value: d.id, label: name(d) }))}
        required={requireArea}
      />
      <SelectField
        label={labels?.area ?? t.common.area}
        name="areaId"
        value={areaId ?? ""}
        disabled={!districtId}
        onChange={(e) => onChange({ divisionId, districtId, areaId: e.target.value || undefined })}
        placeholder={any ? t.common.anyArea : t.common.selectArea}
        options={areas.map((d) => ({ value: d.id, label: name(d) }))}
        required={requireArea}
        error={error}
      />
    </div>
  );
}
