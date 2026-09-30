"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt, localizeDigits } from "@/i18n";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/time";
import { Button, Card, CheckIcon, Spinner, cx } from "@/components/ui";
import { TextArea } from "@/components/client/fields";
import { useAction } from "@/components/client/use-action";

type Center = { id: string; name: string; address: string; openTime: string; closeTime: string };
type Slot = { hour: number; startsAt: string; remaining: number; capacity: number; past: boolean };
type Day = { date: string; dow: number; slots: Slot[] };

export function BookingWizard({ centers, initialCenterId, campaignId, rescheduleId, disabled, earliest }: { centers: Center[]; initialCenterId?: string; campaignId?: string; rescheduleId?: string; disabled: boolean; earliest: string | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [centerId, setCenterId] = useState(initialCenterId && centers.some((c) => c.id === initialCenterId) ? initialCenterId : "");
  const [days, setDays] = useState<Day[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<string>("");
  const [notes, setNotes] = useState("");
  const { run, pending } = useAction<{ id: string }>();

  useEffect(() => {
    if (!centerId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while loading new center
    setDays(null);
    setFailed(false);
    setSlot("");
    api<Day[]>(`/api/centers/${centerId}/slots?days=21`).then((r) => {
      if (!alive) return;
      if (!r.ok) return setFailed(true);
      setDays(r.data);
      const first = r.data.find((d) => d.slots.some((s) => !s.past && s.remaining > 0 && (!earliest || s.startsAt >= earliest)));
      setDate(first?.date ?? r.data[0]?.date ?? "");
    });
    return () => {
      alive = false;
    };
  }, [centerId, earliest]);

  const day = days?.find((d) => d.date === date);
  const isOpenSlot = (s: Slot) => !s.past && s.remaining > 0 && (!earliest || s.startsAt >= earliest);
  const morning = day?.slots.filter((s) => s.hour < 13) ?? [];
  const evening = day?.slots.filter((s) => s.hour >= 13) ?? [];
  const weekday = (d: Day) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d.date}T00:00:00Z`));
  const hourLabel = (h: number) => localizeDigits(`${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`, locale);

  const confirmBooking = async () => {
    const res = rescheduleId
      ? await run(`/api/appointments/${rescheduleId}`, { method: "PATCH", body: { startsAt: slot }, success: t.appointments.booked, refresh: false })
      : await run("/api/appointments", { body: { centerId, startsAt: slot, notes: notes || undefined, campaignId }, success: t.appointments.booked, refresh: false });
    if (res) {
      router.push("/appointments");
      router.refresh();
    }
  };

  const slotGrid = (list: Slot[], title: string) => (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted">{title}</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{t.appointments.noSlots}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={title}>
          {list.map((s) => {
            const open = isOpenSlot(s);
            const sel = slot === s.startsAt;
            return (
              <button
                key={s.startsAt}
                type="button"
                role="radio"
                aria-checked={sel}
                disabled={!open || disabled}
                onClick={() => setSlot(s.startsAt)}
                className={cx("flex min-h-14 flex-col items-center justify-center rounded-xl border text-sm font-semibold", sel ? "border-primary bg-primary text-white" : "border-border bg-surface", !open && "opacity-40")}
              >
                {hourLabel(s.hour)}
                <span className={cx("text-[11px] font-normal", sel ? "text-white/85" : "text-muted")}>{s.past ? "—" : fmt(t.appointments.slotsLeft, { n: localizeDigits(s.remaining, locale) })}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-3 font-bold">1. {t.appointments.chooseCenter}</h2>
        <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {centers.map((c) => (
            <li key={c.id}>
              <button type="button" role="radio" aria-checked={centerId === c.id} onClick={() => setCenterId(c.id)} disabled={!!rescheduleId && c.id !== initialCenterId} className={cx("w-full rounded-xl border p-3 text-left", centerId === c.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary/60", rescheduleId && c.id !== initialCenterId && "opacity-40")}>
                <span className="flex items-center justify-between gap-2 font-semibold">{c.name} {centerId === c.id && <CheckIcon className="size-4 text-primary" />}</span>
                <span className="block text-sm text-muted">{c.address} · {c.openTime}–{c.closeTime}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {centerId && (
        <Card>
          <h2 className="mb-3 font-bold">2. {t.appointments.chooseDate}</h2>
          {failed ? (
            <p className="text-sm text-danger">{t.common.errorGeneric}</p>
          ) : !days ? (
            <p className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" /> {t.common.loading}</p>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label={t.appointments.chooseDate}>
              {days.map((d) => {
                const avail = d.slots.filter(isOpenSlot).length;
                const sel = d.date === date;
                return (
                  <button key={d.date} type="button" role="radio" aria-checked={sel} onClick={() => { setDate(d.date); setSlot(""); }} className={cx("flex min-w-16 flex-col items-center rounded-xl border px-2 py-2", sel ? "border-primary bg-primary text-white" : "border-border bg-surface", !avail && !sel && "opacity-45")}>
                    <span className="text-[11px] uppercase">{weekday(d)}</span>
                    <span className="text-lg font-bold">{localizeDigits(Number(d.date.slice(8)), locale)}</span>
                    <span className={cx("size-1.5 rounded-full", avail ? (sel ? "bg-white" : "bg-success") : "bg-transparent")} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
          {day && (
            <div className="mt-4 space-y-4">
              <h3 className="font-bold">3. {t.appointments.chooseTime}</h3>
              {slotGrid(morning, t.appointments.morning)}
              {slotGrid(evening, t.appointments.evening)}
            </div>
          )}
        </Card>
      )}

      {slot && (
        <Card className="sticky bottom-20 z-20 md:bottom-4">
          <p className="font-semibold">{centers.find((c) => c.id === centerId)?.name}</p>
          <p className="text-sm text-muted">{formatDateTime(slot, locale)}</p>
          {!rescheduleId && <TextArea className="mt-3" label={`${t.common.note} (${t.common.optional})`} name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />}
          <Button size="lg" className="mt-3 w-full" loading={pending} disabled={disabled} onClick={confirmBooking}>
            {t.appointments.confirmBooking}
          </Button>
        </Card>
      )}
    </div>
  );
}
