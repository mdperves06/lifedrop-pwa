"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { Button, Card, FlagIcon, XIcon } from "@/components/ui";
import { SelectField, TextArea } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

const REASONS = ["FAKE_DONOR", "SPAM", "ABUSE", "FRAUD", "INCORRECT_INFO", "INAPPROPRIATE"] as const;

export function ReportButton({ targetUserId, bloodRequestId, compact }: { targetUserId?: string; bloodRequestId?: string; compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>(targetUserId ? "FAKE_DONOR" : "INCORRECT_INFO");
  const [details, setDetails] = useState("");
  const { run, pending } = useAction();
  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted" onClick={() => setOpen(true)} aria-label={t.report.title}>
        <FlagIcon className="size-4" /> {!compact && t.common.report}
      </Button>
      {open && (
        <div className="fixed inset-0 z-[55] grid place-items-end bg-black/40 p-3 sm:place-items-center" role="dialog" aria-modal="true" aria-label={t.report.title} onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">{t.report.title}</h2>
              <button className="grid size-9 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setOpen(false)} aria-label={t.nav.close}><XIcon className="size-4" /></button>
            </div>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await run("/api/reports", { body: { targetUserId, bloodRequestId, reason, details: details || undefined }, success: t.report.sent, refresh: false });
                if (ok) setOpen(false);
              }}
            >
              <SelectField label={t.report.reason} name="reason" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])} options={REASONS.map((r) => ({ value: r, label: t.report.reasons[r] }))} />
              <TextArea label={t.report.details} name="details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
              <Button type="submit" className="w-full" loading={pending}>{t.report.send}</Button>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
