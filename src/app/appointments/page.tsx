import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { requirePageUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/time";
import { Badge, Card, CalendarIcon, EmptyState, LinkButton, MapPinIcon, PageHeader } from "@/components/ui";
import { AppointmentActions } from "./actions";

export const metadata: Metadata = { title: "Appointments", robots: { index: false } };

const tone = { BOOKED: "info", CHECKED_IN: "success", COMPLETED: "success", CANCELLED: "neutral", NO_SHOW: "warning" } as const;

export default async function AppointmentsPage() {
  const user = await requirePageUser();
  const { t, locale } = await getDictionary();
  const appts = await db.appointment.findMany({ where: { donorId: user.id }, orderBy: { startsAt: "desc" }, take: 50, include: { center: { select: { id: true, name: true, address: true, lat: true, lng: true } } } });
  const upcoming = appts.filter((a) => a.status === "BOOKED" || a.status === "CHECKED_IN").reverse();
  const past = appts.filter((a) => !upcoming.includes(a));

  const card = (a: (typeof appts)[number], actions: boolean) => (
    <li key={a.id}>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{a.center.name}</p>
            <p className="flex items-center gap-1 text-sm text-muted"><MapPinIcon className="size-4" /> {a.center.address}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm"><CalendarIcon className="size-4" /> {formatDateTime(a.startsAt, locale)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={tone[a.status]}>{t.appointmentStatus[a.status]}</Badge>
            {a.isWalkIn && <Badge>Walk-in</Badge>}
          </div>
        </div>
        {actions && <AppointmentActions id={a.id} centerId={a.center.id} canReschedule={a.status === "BOOKED"} lat={a.center.lat} lng={a.center.lng} />}
      </Card>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.appointments.title} actions={<LinkButton href="/appointments/new"><CalendarIcon className="size-4" /> {t.appointments.book}</LinkButton>} />
      {appts.length === 0 ? (
        <EmptyState icon={<CalendarIcon className="size-10" />} title={t.appointments.none} action={<LinkButton href="/appointments/new">{t.appointments.book}</LinkButton>} />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-bold">{t.appointments.upcoming}</h2>
            {upcoming.length ? <ul className="space-y-3">{upcoming.map((a) => card(a, true))}</ul> : <p className="text-sm text-muted">{t.dashboard.noUpcoming}</p>}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">{t.appointments.past}</h2>
              <ul className="space-y-3">{past.map((a) => card(a, false))}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
