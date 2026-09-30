"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n";
import { distanceKm } from "@/lib/geo";
import { bloodLabel } from "@/lib/blood";
import { Badge, Button, Card, ClockIcon, MapPinIcon, PhoneIcon, StarIcon, buttonClass } from "@/components/ui";
import type { MapPoint } from "@/components/client/map";

const CentersMap = dynamic(() => import("@/components/client/map").then((m) => m.CentersMap), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-xl bg-surface-2" />,
});

type C = { id: string; name: string; address: string; phone: string; area: string; areaBn: string; lat: number; lng: number; openTime: string; closeTime: string; status: "OPEN" | "CLOSED" | "FULL"; neededBloodGroups: string[]; rating: { avg: number; count: number } };

const tone = { OPEN: "success", FULL: "warning", CLOSED: "neutral" } as const;

export function CentersExplorer({ centers }: { centers: C[] }) {
  const { t, locale } = useI18n();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  // User position is used only in the browser to sort — it is never sent to the server.
  const locate = () => {
    if (!navigator.geolocation) return setDenied(true);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setDenied(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const sorted = useMemo(() => {
    const withD = centers.map((c) => ({ ...c, d: pos ? distanceKm(pos, c) : null }));
    return pos ? withD.sort((a, b) => a.d! - b.d!) : withD;
  }, [centers, pos]);
  const points: MapPoint[] = useMemo(() => centers.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, label: c.name, status: c.status, href: `/centers/${c.id}` })), [centers]);
  const statusLabel = { OPEN: t.common.open, FULL: t.common.full, CLOSED: t.common.closed };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="order-2 space-y-3 lg:order-1">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={locate} loading={locating}>
            <MapPinIcon className="size-4" /> {locating ? t.centers.locating : t.centers.nearest}
          </Button>
          {denied && <p className="text-sm text-muted">{t.centers.locationDenied}</p>}
        </div>
        <ul className="space-y-3">
          {sorted.map((c) => (
            <li key={c.id}>
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/centers/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link>
                  <Badge tone={tone[c.status]}>{statusLabel[c.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{c.address} · {locale === "bn" ? c.areaBn : c.area}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1"><ClockIcon className="size-4 text-muted" /> {c.openTime}–{c.closeTime}</span>
                  {c.rating.count > 0 && <span className="flex items-center gap-1"><StarIcon className="size-4 text-warning" filled /> {c.rating.avg} ({c.rating.count})</span>}
                  {c.d != null && <span className="font-semibold text-primary">{fmt(t.centers.distanceAway, { km: c.d.toFixed(1) })}</span>}
                </div>
                {c.neededBloodGroups.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted">{t.centers.needed}: </span>
                    {c.neededBloodGroups.map((g) => <Badge key={g} tone="primary" className="mr-1">{bloodLabel(g)}</Badge>)}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/appointments/new?centerId=${c.id}`} className={buttonClass("primary", "sm")}>{t.appointments.book}</Link>
                  <a href={`tel:${c.phone}`} className={buttonClass("outline", "sm")}><PhoneIcon className="size-4" /> {t.common.call}</a>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>{t.common.directions}</a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
      <div className="order-1 lg:sticky lg:top-20 lg:order-2 lg:self-start">
        <CentersMap points={points} userPos={pos} height={380} />
      </div>
    </div>
  );
}
