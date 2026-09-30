"use client";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button, EmptyState, AlertIcon } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={<AlertIcon className="size-10" />} title={t.errors.serverError} body={typeof navigator !== "undefined" && !navigator.onLine ? t.common.errorNetwork : t.common.errorGeneric} action={<Button onClick={reset}>{t.common.retry}</Button>} />
    </div>
  );
}
