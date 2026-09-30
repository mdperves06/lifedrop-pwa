"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Card } from "@/components/ui";
import { TextField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ devResetLink?: string } | null>(null);
  const { run, pending, errors } = useAction<{ devResetLink?: string }>();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">{t.auth.forgotTitle}</h1>
      <p className="mb-5 mt-1 text-muted">{t.auth.forgotSubtitle}</p>
      <Card>
        {done ? (
          <div className="space-y-3">
            <Alert tone="success">{t.auth.linkSent}</Alert>
            {done.devResetLink && (
              <Alert tone="info" title={t.auth.devLink}>
                <a className="break-all font-mono text-xs text-info underline" href={done.devResetLink}>{done.devResetLink}</a>
              </Alert>
            )}
            <Link href="/login" className="font-semibold text-primary">{t.auth.signIn}</Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const d = await run("/api/auth/forgot", { body: { email }, refresh: false });
              if (d) setDone(d);
            }}
          >
            <TextField label={t.common.email} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
            <Button type="submit" size="lg" className="w-full" loading={pending}>{t.auth.sendLink}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
