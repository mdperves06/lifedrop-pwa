"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button, inputClass } from "@/components/ui";
import { useAction } from "@/components/client/use-action";

export function ReportActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const act = (s: string, action: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    run(`/api/admin/reports/${id}`, { method: "PATCH", body: { status: s, action, adminNote: note || undefined }, success: t.common.saved });
  };
  return (
    <div className="flex w-full flex-col gap-2 sm:w-64">
      <input className={inputClass + " min-h-9 text-sm"} placeholder={t.common.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} aria-label={t.common.note} />
      <div className="flex flex-wrap gap-1">
        {status === "PENDING" && <Button size="sm" variant="outline" loading={pending} onClick={() => act("REVIEWING", "NONE")}>{t.admin.review}</Button>}
        <Button size="sm" variant="outline" loading={pending} onClick={() => act("RESOLVED", "WARN")}>{t.admin.warn}</Button>
        <Button size="sm" variant="outline" loading={pending} onClick={() => act("RESOLVED", "SUSPEND", `${t.admin.suspend}?`)}>{t.admin.suspend}</Button>
        <Button size="sm" variant="danger" loading={pending} onClick={() => act("RESOLVED", "REMOVE", `${t.admin.remove}?`)}>{t.admin.remove}</Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => act("RESOLVED", "NONE")}>{t.admin.resolve}</Button>
        <Button size="sm" variant="ghost" loading={pending} onClick={() => act("DISMISSED", "NONE")}>{t.admin.dismiss}</Button>
      </div>
    </div>
  );
}
