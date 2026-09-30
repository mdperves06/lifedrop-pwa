"use client";
import { useI18n } from "@/i18n/client";
import { Button, LinkButton, buttonClass } from "@/components/ui";
import { useAction } from "@/components/client/use-action";

export function AppointmentActions({ id, centerId, canReschedule, lat, lng }: { id: string; centerId: string; canReschedule: boolean; lat: number; lng: number }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canReschedule && <LinkButton size="sm" variant="outline" href={`/appointments/new?reschedule=${id}&centerId=${centerId}`}>{t.appointments.reschedule}</LinkButton>}
      <a className={buttonClass("ghost", "sm")} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}>{t.common.directions}</a>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger"
        loading={pending}
        onClick={() => confirm(t.appointments.cancelConfirm) && run(`/api/appointments/${id}`, { method: "DELETE", success: t.common.success })}
      >
        {t.appointments.cancel}
      </Button>
    </div>
  );
}
