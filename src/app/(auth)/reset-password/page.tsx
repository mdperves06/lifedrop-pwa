"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Card } from "@/components/ui";
import { TextField } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

function ResetForm() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const { run, pending, errors, error } = useAction();
  if (!token) return <Alert tone="danger">{t.auth.verifyFailed}</Alert>;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) return setMismatch(true);
        setMismatch(false);
        const ok = await run("/api/auth/reset", { body: { token, password }, success: t.auth.resetDone, refresh: false });
        if (ok) router.replace("/login");
      }}
    >
      {error?.code === "INVALID_TOKEN" && <Alert tone="danger">{error.message}</Alert>}
      <TextField label={t.auth.newPassword} name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint={t.auth.passwordHint} required />
      <TextField label={t.auth.confirmPassword} name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? t.auth.passwordMismatch : undefined} required />
      <Button type="submit" size="lg" className="w-full" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-5 text-2xl font-bold">{t.auth.resetTitle}</h1>
      <Card>
        <Suspense>
          <ResetForm />
        </Suspense>
      </Card>
    </div>
  );
}
