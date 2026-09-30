import "server-only";
import type { Center } from "@prisma/client";
import { db } from "@/server/db";
import { fromLocal, hhmmToMinutes, localParts, MORNING_HOURS, EVENING_HOURS, addDays, parseDateKey } from "@/lib/time";
import { BLOOD_GROUPS, type BloodGroupCode } from "@/lib/blood";

export type CenterLiveStatus = "OPEN" | "CLOSED" | "FULL";

export function isOpenDay(center: Pick<Center, "openDays">, dow: number) {
  return center.openDays.split(",").map(Number).includes(dow);
}

/** Hours (local) that are bookable at this center on a given weekday. */
export function bookableHours(center: Pick<Center, "openTime" | "closeTime" | "openDays">, dow: number) {
  if (!isOpenDay(center, dow)) return [];
  const open = hhmmToMinutes(center.openTime);
  const close = hhmmToMinutes(center.closeTime);
  return [...MORNING_HOURS, ...EVENING_HOURS].filter((h) => h * 60 >= open && (h + 1) * 60 <= close);
}

/** Real-time status: manual override wins, otherwise computed from hours and current-slot load. */
export async function liveStatus(center: Center, now = new Date()): Promise<CenterLiveStatus> {
  if (center.statusOverride !== "AUTO") return center.statusOverride;
  if (!center.isActive) return "CLOSED";
  const p = localParts(now);
  const minutes = p.h * 60 + p.min;
  if (!isOpenDay(center, p.dow) || minutes < hhmmToMinutes(center.openTime) || minutes >= hhmmToMinutes(center.closeTime)) return "CLOSED";
  const slotStart = fromLocal(p.y, p.m, p.d, p.h);
  const booked = await db.appointment.count({
    where: { centerId: center.id, startsAt: { gte: slotStart, lt: new Date(slotStart.getTime() + 3_600_000) }, status: { in: ["BOOKED", "CHECKED_IN"] } },
  });
  return booked >= center.capacityPerSlot ? "FULL" : "OPEN";
}

export async function centerRatings(centerIds: string[]) {
  const rows = await db.review.groupBy({ by: ["centerId"], where: { centerId: { in: centerIds } }, _avg: { rating: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.centerId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]));
}

export async function listCenters() {
  const centers = await db.center.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { location: { select: { name: true, nameBn: true } } } });
  const ratings = await centerRatings(centers.map((c) => c.id));
  const now = new Date();
  return Promise.all(
    centers.map(async (c) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      phone: c.phone,
      area: c.location.name,
      areaBn: c.location.nameBn ?? c.location.name,
      lat: c.lat,
      lng: c.lng,
      openTime: c.openTime,
      closeTime: c.closeTime,
      openDays: c.openDays,
      status: await liveStatus(c, now),
      neededBloodGroups: parseGroups(c.neededBloodGroups),
      rating: ratings.get(c.id) ?? { avg: 0, count: 0 },
    })),
  );
}

export function parseGroups(csv: string): BloodGroupCode[] {
  return csv.split(",").filter((g): g is BloodGroupCode => (BLOOD_GROUPS as readonly string[]).includes(g));
}

export function parseEquipment(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type DaySlots = { date: string; dow: number; slots: { hour: number; startsAt: string; remaining: number; capacity: number; past: boolean }[] };

/** Slot availability for the next `days` days (local calendar). */
export async function slotAvailability(centerId: string, fromKey?: string, days = 14): Promise<DaySlots[]> {
  const center = await db.center.findUnique({ where: { id: centerId } });
  if (!center || !center.isActive) return [];
  const now = new Date();
  const start = fromKey && parseDateKey(fromKey) ? (() => { const k = parseDateKey(fromKey)!; return fromLocal(k.y, k.m, k.d); })() : (() => { const p = localParts(now); return fromLocal(p.y, p.m, p.d); })();
  const end = addDays(start, days);
  const appts = await db.appointment.groupBy({
    by: ["startsAt"],
    where: { centerId, startsAt: { gte: start, lt: end }, status: { in: ["BOOKED", "CHECKED_IN", "COMPLETED"] }, isWalkIn: false },
    _count: { _all: true },
  });
  const load = new Map(appts.map((a) => [a.startsAt.getTime(), a._count._all]));
  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const p = localParts(day);
    const hours = center.statusOverride === "CLOSED" ? [] : bookableHours(center, p.dow);
    out.push({
      date: `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`,
      dow: p.dow,
      slots: hours.map((h) => {
        const s = fromLocal(p.y, p.m, p.d, h);
        const used = load.get(s.getTime()) ?? 0;
        return { hour: h, startsAt: s.toISOString(), capacity: center.capacityPerSlot, remaining: Math.max(0, center.capacityPerSlot - used), past: s.getTime() <= now.getTime() };
      }),
    });
  }
  return out;
}
