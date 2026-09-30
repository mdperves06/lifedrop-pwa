"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui";
import { TextField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

const DEMO = [
  ["Admin", "admin@lifedrop.test"],
  ["Center staff", "staff@lifedrop.test"],
  ["Hospital", "hospital@lifedrop.test"],
  ["Donor", "donor@lifedrop.test"],
  ["Requester", "requester@lifedrop.test"],
];

// Uncontrolled inputs: anything typed before hydration on a slow connection is kept.
export function LoginForm({ next, showDemo }: { next?: string; showDemo: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const idRef = useRef<HTMLInputElement>(null);
  const { run, pending, errors } = useAction<{ redirect: string }>();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = await run("/api/auth/login", { body: { identifier: String(fd.get("identifier") ?? ""), password: String(fd.get("password") ?? "") }, refresh: false });
    if (data) {
      router.replace(next ?? data.redirect);
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField ref={idRef} label={t.auth.identifier} name="identifier" autoComplete="username" inputMode="email" error={errors.identifier} required />
      <TextField label={t.auth.password} name="password" type="password" autoComplete="current-password" error={errors.password} required />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary">{t.auth.forgot}</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>{pending ? t.auth.signingIn : t.auth.signIn}</Button>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount} <Link className="font-semibold text-primary" href="/register">{t.auth.createAccount}</Link>
      </p>
      {showDemo && (
        <details className="rounded-xl bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{t.auth.demoAccounts}</summary>
          <p className="mt-2 text-muted">Development only. Password for all demo accounts is in <code>prisma/seed.ts</code>.</p>
          <ul className="mt-2 grid gap-1">
            {DEMO.map(([role, email]) => (
              <li key={email}>
                <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => idRef.current && (idRef.current.value = email)}>
                  {role}: {email}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </form>
  );
}
