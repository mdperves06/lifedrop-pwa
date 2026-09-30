"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Card, cx } from "@/components/ui";
import { BloodGroupPicker, Checkbox, LocationPicker, SelectField, TextField, type Loc } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";
import { registerSchema } from "@/lib/validation";

type Step = 0 | 1 | 2;
const STEP_FIELDS: Record<Step, string[]> = {
  0: ["name", "email", "phone", "password"],
  1: ["bloodGroup", "locationId", "dateOfBirth", "weightKg", "gender", "lastDonationDate"],
  2: ["healthDeclarationOk", "acceptTerms"],
};

export function RegisterForm({ locations, referralCode }: { locations: Loc[]; referralCode?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [f, setF] = useState({
    name: "", email: "", phone: "", password: "", confirm: "",
    bloodGroup: "", loc: {} as { divisionId?: string; districtId?: string; areaId?: string },
    dateOfBirth: "", weightKg: "", gender: "UNDISCLOSED", lastDonationDate: "",
    healthDeclarationOk: false, wantsToDonate: true, acceptTerms: false, referralCode: referralCode ?? "",
  });
  const [local, setLocal] = useState<Record<string, string>>({});
  const [devLink, setDevLink] = useState<string | null>(null);
  const { run, pending, errors } = useAction<{ id: string; devVerifyLink?: string }>();
  const allErrors = { ...errors, ...local };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const payload = () => ({
    name: f.name, email: f.email, phone: f.phone, password: f.password, bloodGroup: f.bloodGroup, locationId: f.loc.areaId ?? "",
    dateOfBirth: f.dateOfBirth, weightKg: f.weightKg, gender: f.gender, lastDonationDate: f.lastDonationDate || null,
    healthDeclarationOk: f.healthDeclarationOk, wantsToDonate: f.wantsToDonate, acceptTerms: f.acceptTerms,
    referralCode: f.referralCode || undefined, locale,
  });

  /** Client-side validation of the current step for fast feedback (server re-validates everything). */
  const validateStep = (s: Step) => {
    const res = registerSchema.safeParse(payload());
    const errs: Record<string, string> = {};
    if (!res.success) {
      for (const i of res.error.issues) {
        const k = String(i.path[0]);
        if (STEP_FIELDS[s].includes(k) && !errs[k]) errs[k] = i.message;
      }
    }
    if (s === 0 && f.password !== f.confirm) errs.confirm = t.auth.passwordMismatch;
    setLocal(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => validateStep(step) && setStep((s) => (s + 1) as Step);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) return nextStep();
    if (!validateStep(2)) return;
    const data = await run("/api/auth/register", {
      body: payload(),
      refresh: false,
      onError: (err) => {
        const d = (err.details ?? {}) as Record<string, string>;
        if (STEP_FIELDS[0].some((k) => d[k])) setStep(0);
        else if (STEP_FIELDS[1].some((k) => d[k])) setStep(1);
      },
    });
    if (data) {
      if (data.devVerifyLink) setDevLink(data.devVerifyLink);
      else {
        router.replace("/dashboard?welcome=1");
        router.refresh();
      }
    }
  };

  if (devLink) {
    return (
      <Card className="space-y-3">
        <Alert tone="success" title={t.common.success}>{t.auth.verifyEmailBanner}</Alert>
        <Alert tone="info" title={t.auth.devLink}>
          <a className="break-all font-mono text-xs text-info underline" href={devLink}>{devLink}</a>
        </Alert>
        <Button onClick={() => { router.replace("/dashboard?welcome=1"); router.refresh(); }}>{t.nav.dashboard}</Button>
      </Card>
    );
  }

  const steps = [t.auth.step1, t.auth.step2, t.auth.step3];
  return (
    <Card>
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="text-center">
            <span className={cx("mx-auto mb-1 block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-surface-2")} />
            <span className={cx("text-xs font-medium", i === step ? "text-fg" : "text-muted")}>{s}</span>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {step === 0 && (
          <>
            <TextField label={t.auth.fullName} name="name" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} error={allErrors.name} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.common.email} name="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={allErrors.email} required />
              <TextField label={t.common.phone} name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => set("phone", e.target.value)} error={allErrors.phone} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.auth.password} name="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} error={allErrors.password} hint={t.auth.passwordHint} required />
              <TextField label={t.auth.confirmPassword} name="confirm" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} error={allErrors.confirm} required />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <BloodGroupPicker label={t.common.bloodGroup} value={f.bloodGroup} onChange={(v) => set("bloodGroup", v)} error={allErrors.bloodGroup} />
            <LocationPicker value={f.loc} onChange={(v) => set("loc", v)} error={allErrors.locationId} initialLocations={locations} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={t.auth.dob} name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} value={f.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} error={allErrors.dateOfBirth} required />
              <TextField label={t.auth.weight} name="weightKg" type="number" inputMode="numeric" value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} error={allErrors.weightKg} required />
              <SelectField
                label={t.auth.gender}
                name="gender"
                value={f.gender}
                onChange={(e) => set("gender", e.target.value)}
                options={(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const).map((g) => ({ value: g, label: t.auth[`gender${g}`] }))}
              />
            </div>
            <TextField label={t.auth.lastDonation} name="lastDonationDate" type="date" max={new Date().toISOString().slice(0, 10)} value={f.lastDonationDate} onChange={(e) => set("lastDonationDate", e.target.value)} error={allErrors.lastDonationDate} hint={t.auth.lastDonationHint} />
          </>
        )}
        {step === 2 && (
          <>
            <Checkbox label={t.auth.healthDeclaration} checked={f.healthDeclarationOk} onChange={(v) => set("healthDeclarationOk", v)} error={allErrors.healthDeclarationOk} />
            <Checkbox label={t.auth.wantsToDonate} checked={f.wantsToDonate} onChange={(v) => set("wantsToDonate", v)} />
            <Checkbox label={t.auth.acceptTerms} checked={f.acceptTerms} onChange={(v) => set("acceptTerms", v)} error={allErrors.acceptTerms} />
            <TextField label={`${t.auth.referredBy} (${t.common.optional})`} name="referralCode" value={f.referralCode} onChange={(e) => set("referralCode", e.target.value)} />
            <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">{t.app.disclaimer}</p>
          </>
        )}
        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => (s - 1) as Step)}>
              {t.common.back}
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={pending}>
            {step < 2 ? t.common.next : pending ? t.auth.registering : t.auth.createAccount}
          </Button>
        </div>
        <p className="text-center text-sm text-muted">
          {t.auth.haveAccount} <Link className="font-semibold text-primary" href="/login">{t.auth.signIn}</Link>
        </p>
      </form>
    </Card>
  );
}
