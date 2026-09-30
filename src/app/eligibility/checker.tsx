"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n";
import { checkEligibility, type EligibilityResult } from "@/lib/eligibility";
import { formatDate } from "@/lib/time";
import { Alert, Button, Card, LinkButton } from "@/components/ui";
import { Checkbox, TextField } from "@/components/client/fields";

export function EligibilityChecker({ intervalDays }: { intervalDays: number }) {
  const { t, locale } = useI18n();
  const [f, setF] = useState({ age: "", weight: "", last: "", feelingWell: true, recentIllness: false, recentTattoo: false, pregnant: false, antibiotics: false, chronic: false });
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(
      checkEligibility(
        {
          age: f.age ? Number(f.age) : null,
          weightKg: f.weight ? Number(f.weight) : null,
          lastDonationDate: f.last || null,
          feelingWell: f.feelingWell,
          recentIllness: f.recentIllness,
          recentTattoo: f.recentTattoo,
          pregnant: f.pregnant,
          onAntibiotics: f.antibiotics,
          chronicCondition: f.chronic,
        },
        { intervalDays, requireAll: true },
      ),
    );
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t.eligibility.age} name="age" type="number" inputMode="numeric" min={1} max={120} value={f.age} onChange={(e) => set("age", e.target.value)} required />
          <TextField label={t.eligibility.weight} name="weight" type="number" inputMode="numeric" min={1} max={300} value={f.weight} onChange={(e) => set("weight", e.target.value)} required />
          <TextField label={t.eligibility.lastDonation} name="last" type="date" max={new Date().toISOString().slice(0, 10)} value={f.last} onChange={(e) => set("last", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Checkbox label={t.eligibility.feelingWell} checked={f.feelingWell} onChange={(v) => set("feelingWell", v)} />
          <Checkbox label={t.eligibility.recentIllness} checked={f.recentIllness} onChange={(v) => set("recentIllness", v)} />
          <Checkbox label={t.eligibility.recentTattoo} checked={f.recentTattoo} onChange={(v) => set("recentTattoo", v)} />
          <Checkbox label={t.eligibility.pregnant} checked={f.pregnant} onChange={(v) => set("pregnant", v)} />
          <Checkbox label={t.eligibility.antibiotics} checked={f.antibiotics} onChange={(v) => set("antibiotics", v)} />
          <Checkbox label={t.eligibility.chronic} checked={f.chronic} onChange={(v) => set("chronic", v)} />
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto">{t.eligibility.check}</Button>
      </form>

      {result && (
        <div className="mt-5" aria-live="polite">
          {result.eligible ? (
            <Alert tone="success" title={t.eligibility.eligible}>
              <p>{t.eligibility.eligibleBody}</p>
              <LinkButton href="/appointments/new" size="sm" className="mt-3">{t.appointments.book}</LinkButton>
            </Alert>
          ) : (
            <Alert tone="warning" title={t.eligibility.notEligible}>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.issues.map((i) => (
                  <li key={i}>{t.appointments.issues[i]}</li>
                ))}
              </ul>
              {result.nextEligibleDate && <p className="mt-2 font-medium">{fmt(t.eligibility.nextDate, { date: formatDate(result.nextEligibleDate, locale) })}</p>}
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}
