"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Alert, Card, LinkButton, Spinner } from "@/components/ui";
import { api } from "@/lib/api-client";

function Verify() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "fail">(token ? "loading" : "fail");
  const once = useRef(false);
  useEffect(() => {
    if (!token || once.current) return;
    once.current = true;
    api("/api/auth/verify-email", { body: { token } }).then((r) => setState(r.ok ? "ok" : "fail"));
  }, [token]);
  if (state === "loading")
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner /> {t.auth.verifying}
      </p>
    );
  return (
    <div className="space-y-4">
      <Alert tone={state === "ok" ? "success" : "danger"}>{state === "ok" ? t.auth.verified : t.auth.verifyFailed}</Alert>
      <LinkButton href="/dashboard">{t.nav.dashboard}</LinkButton>
    </div>
  );
}

export default function VerifyPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-5 text-2xl font-bold">{t.auth.verifyTitle}</h1>
      <Card>
        <Suspense>
          <Verify />
        </Suspense>
      </Card>
    </div>
  );
}
