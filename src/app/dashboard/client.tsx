"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert, Button, Card, cx } from "@/components/ui";
import { TextField, Toggle } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";
import { useToast } from "@/components/client/toast";

export function AvailabilityCard({ availability, emergency }: { availability: string; emergency: boolean }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const available = availability === "AVAILABLE";
  return (
    <Card className={cx(available ? "border-success/40" : "border-border")}>
      <p className={cx("text-sm font-bold tracking-wide", available ? "text-success" : "text-muted")}>{available ? t.availability.availableToDonate : t.availability.notAvailableToDonate}</p>
      <p className="text-sm text-muted">{t.availability[availability as keyof typeof t.availability] as string}</p>
      <Button
        size="lg"
        variant={available ? "outline" : "success"}
        className="mt-3 w-full"
        loading={pending}
        onClick={() => run("/api/me/donor", { method: "PATCH", body: { availability: available ? "TEMP_UNAVAILABLE" : "AVAILABLE" }, success: t.common.saved })}
        aria-pressed={available}
      >
        {t.availability.toggle}
      </Button>
      <div className="mt-2">
        <Toggle label={t.availability.emergency} checked={emergency} disabled={pending} onChange={(v) => run("/api/me/donor", { method: "PATCH", body: { emergencyAvailable: v }, success: t.common.saved })} />
      </div>
    </Card>
  );
}

export function VerifyBanner({ hasEmail }: { hasEmail: boolean }) {
  const { t } = useI18n();
  const email = useAction<{ devVerifyLink?: string }>();
  const otp = useAction<{ devCode?: string }>();
  const verify = useAction();
  const [dev, setDev] = useState<{ link?: string; code?: string }>({});
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <Alert tone="warning" title={t.auth.verifyEmailBanner}>
      <div className="mt-2 flex flex-wrap gap-2">
        {hasEmail && (
          <Button size="sm" variant="outline" loading={email.pending} onClick={() => email.run("/api/auth/resend-verification", { success: t.common.success, refresh: false, onSuccess: (d) => setDev((s) => ({ ...s, link: d.devVerifyLink })) })}>
            {t.auth.resendEmail}
          </Button>
        )}
        <Button size="sm" variant="outline" loading={otp.pending} onClick={() => otp.run("/api/auth/phone-otp", { success: t.auth.codeSent, refresh: false, onSuccess: (d) => { setCodeOpen(true); setDev((s) => ({ ...s, code: d.devCode })); } })}>
          {t.auth.verifyPhone}
        </Button>
      </div>
      {dev.link && (
        <p className="mt-2 break-all text-xs">
          {t.auth.devLink} <a className="font-mono underline" href={dev.link}>{dev.link}</a>
        </p>
      )}
      {codeOpen && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            verify.run("/api/auth/verify-phone", { body: { code }, success: t.auth.verified });
          }}
        >
          <TextField className="max-w-40" label={t.auth.enterCode} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} error={verify.errors.code} />
          <Button type="submit" loading={verify.pending}>{t.common.confirm}</Button>
          {dev.code && <span className="pb-3 text-xs">{t.auth.devCode} <code>{dev.code}</code></span>}
        </form>
      )}
    </Alert>
  );
}

export function CopyLink({ url }: { url: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-sm" aria-label={t.dashboard.referral} onFocus={(e) => e.target.select()} />
      <Button
        variant="outline"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: "LifeDrop", text: "Join me as a blood donor on LifeDrop", url });
            else {
              await navigator.clipboard.writeText(url);
              toast("success", t.common.copied);
            }
          } catch {}
        }}
      >
        {t.common.share}
      </Button>
    </div>
  );
}
