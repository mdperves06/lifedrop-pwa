"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { Button, Card } from "@/components/ui";
import { BloodGroupPicker, LocationPicker, Toggle, type Loc } from "@/components/client/fields";

type F = { bloodGroup?: string; compatible: boolean; divisionId?: string; districtId?: string; areaId?: string; availableNow: boolean; emergency: boolean; recentlyActive: boolean };

export function DonorFilters({ initial, locations }: { initial: F; locations: Loc[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState<F>(initial);
  const [pending, start] = useTransition();

  const apply = (next: F = f) => {
    const s = new URLSearchParams();
    if (next.bloodGroup) s.set("bloodGroup", next.bloodGroup);
    if (next.compatible) s.set("compatible", "1");
    if (next.areaId) s.set("areaId", next.areaId);
    else if (next.districtId) s.set("districtId", next.districtId);
    else if (next.divisionId) s.set("divisionId", next.divisionId);
    if (!next.availableNow) s.set("availableNow", "0");
    if (next.emergency) s.set("emergency", "1");
    if (next.recentlyActive) s.set("recentlyActive", "1");
    start(() => router.push(`/donors?${s}`));
  };

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        role="search"
      >
        <BloodGroupPicker label={t.common.bloodGroup} value={f.bloodGroup ?? ""} onChange={(v) => setF({ ...f, bloodGroup: v || undefined })} allowAny anyLabel={t.common.anyGroup} />
        <LocationPicker value={{ divisionId: f.divisionId, districtId: f.districtId, areaId: f.areaId }} onChange={(v) => setF({ ...f, ...v })} requireArea={false} initialLocations={locations} />
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Toggle label={t.search.compatible} checked={f.compatible} onChange={(v) => setF({ ...f, compatible: v })} disabled={!f.bloodGroup} />
          <Toggle label={t.search.availableNow} checked={f.availableNow} onChange={(v) => setF({ ...f, availableNow: v })} />
          <Toggle label={t.search.emergencyOnly} checked={f.emergency} onChange={(v) => setF({ ...f, emergency: v })} />
          <Toggle label={t.search.recentlyActive} checked={f.recentlyActive} onChange={(v) => setF({ ...f, recentlyActive: v })} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={pending}>{t.common.search}</Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              const cleared: F = { compatible: false, availableNow: true, emergency: false, recentlyActive: false };
              setF(cleared);
              apply(cleared);
            }}
          >
            {t.common.reset}
          </Button>
        </div>
      </form>
    </Card>
  );
}
