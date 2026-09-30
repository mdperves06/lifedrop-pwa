"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Card } from "@/components/ui";
import { Toggle } from "@/components/client/fields";
import { disablePush, enablePush, getPushState, type PushState } from "@/components/client/pwa";
import { useToast } from "@/components/client/toast";

export function PushToggle() {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<PushState>("loading");
  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);
  const hint =
    state === "unsupported" ? t.profile.pushUnsupported : state === "denied" ? t.profile.pushDenied : state === "unconfigured" ? t.profile.pushNotConfigured : state === "on" ? t.profile.pushEnabled : undefined;
  return (
    <Card className="py-2 sm:py-3">
      <Toggle
        label={t.profile.pushTitle}
        description={hint}
        checked={state === "on"}
        disabled={state === "loading" || state === "unsupported" || state === "denied" || state === "unconfigured"}
        onChange={async (v) => {
          setState("loading");
          try {
            const next = v ? await enablePush() : await disablePush();
            setState(next);
            if (next === "on") toast("success", t.profile.pushEnabled);
          } catch {
            setState(await getPushState());
            toast("error", t.common.errorGeneric);
          }
        }}
      />
    </Card>
  );
}
