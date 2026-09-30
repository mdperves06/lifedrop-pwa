import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n";
import { db } from "@/server/db";
import { getSessionUser } from "@/server/auth/session";
import { centerRatings, liveStatus, parseEquipment, parseGroups } from "@/server/services/centers";
import { stockByGroup } from "@/server/services/inventory";
import { bloodLabel } from "@/lib/blood";
import { formatDate } from "@/lib/time";
import { Badge, Card, ClockIcon, LinkButton, MapPinIcon, PhoneIcon, StarIcon, buttonClass } from "@/components/ui";
import { StockGrid } from "@/components/blocks";
import { CenterMap, ReviewForm, WalkInButton } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await db.center.findUnique({ where: { id }, select: { name: true, address: true } });
  return c ? { title: c.name, description: `${c.name} — ${c.address}. Hours, live status and booking.` } : { title: "Center" };
}

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export default async function CenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ t, locale }, viewer] = await Promise.all([getDictionary(), getSessionUser()]);
  const c = await db.center.findUnique({
    where: { id },
    include: { location: true, reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } } },
  });
  if (!c || !c.isActive) notFound();
  const [status, ratings, stock, canReview] = await Promise.all([
    liveStatus(c),
    centerRatings([c.id]),
    stockByGroup(c.id),
    viewer ? db.donation.count({ where: { donorId: viewer.id, centerId: c.id } }).then(async (n) => n + (await db.appointment.count({ where: { donorId: viewer.id, centerId: c.id, status: "COMPLETED" } }))) : Promise.resolve(0),
  ]);
  const rating = ratings.get(c.id);
  const needed = parseGroups(c.neededBloodGroups);
  const days = c.openDays.split(",").map(Number).map((d) => (locale === "bn" ? DAYS_BN : DAYS_EN)[d]);
  const statusTone = { OPEN: "success", FULL: "warning", CLOSED: "neutral" } as const;
  const statusLabel = { OPEN: t.common.open, FULL: t.common.full, CLOSED: t.common.closed };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{c.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-muted"><MapPinIcon className="size-4" /> {c.address}, {locale === "bn" ? c.location.nameBn ?? c.location.name : c.location.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[status]} className="text-sm">{statusLabel[status]}</Badge>
            {rating && rating.count > 0 && (
              <span className="flex items-center gap-1 text-sm"><StarIcon className="size-4 text-warning" filled /> {rating.avg} · {rating.count} {t.common.reviews}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/appointments/new?centerId=${c.id}`}>{t.appointments.book}</LinkButton>
          {status === "OPEN" && viewer && <WalkInButton centerId={c.id} />}
          <a className={buttonClass("outline")} href={`tel:${c.phone}`}><PhoneIcon className="size-4" /> {t.common.call}</a>
          <a className={buttonClass("ghost")} target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}>{t.common.directions}</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CenterMap lat={c.lat} lng={c.lng} label={c.name} />
        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted">{t.centers.hours}</dt><dd className="flex items-center gap-1 font-semibold"><ClockIcon className="size-4" /> {c.openTime}–{c.closeTime}</dd></div>
            <div><dt className="text-muted">{t.centers.closedDays}</dt><dd className="font-semibold">{days.join(", ")}</dd></div>
            <div><dt className="text-muted">{t.centers.capacity}</dt><dd className="font-semibold">{fmt(t.centers.perSlot, { n: c.capacityPerSlot })}</dd></div>
            <div><dt className="text-muted">{t.centers.staff} / {t.centers.beds}</dt><dd className="font-semibold">{c.staffCount} / {c.beds}</dd></div>
            <div className="col-span-2"><dt className="text-muted">{t.centers.equipment}</dt><dd className="mt-1 flex flex-wrap gap-1">{parseEquipment(c.equipment).map((e) => <Badge key={e}>{e}</Badge>)}</dd></div>
            <div className="col-span-2"><dt className="text-muted">{t.centers.needed}</dt><dd className="mt-1">{needed.length ? needed.map((g) => <Badge key={g} tone="primary" className="mr-1">{bloodLabel(g)}</Badge>) : t.centers.noneNeeded}</dd></div>
          </dl>
          {c.description && <p className="mt-4 text-sm text-muted">{c.description}</p>}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">{t.centers.stock}</h2>
        <StockGrid levels={stock} t={t} locale={locale} />
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">{t.centers.reviews}</h2>
        {viewer && canReview > 0 ? <ReviewForm centerId={c.id} /> : <p className="mb-3 text-sm text-muted">{t.centers.reviewOnlyAfter}</p>}
        {c.reviews.length === 0 ? (
          <p className="text-sm text-muted">{t.centers.noReviews}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {c.reviews.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.user.name.split(" ")[0]}</span>
                  <span className="flex" aria-label={`${r.rating}/5`}>
                    {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} className="size-4 text-warning" filled={i <= r.rating} />)}
                  </span>
                </div>
                {r.comment && <p className="mt-1">{r.comment}</p>}
                <p className="text-xs text-muted">{formatDate(r.createdAt, locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
