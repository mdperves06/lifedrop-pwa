import "server-only";
import type { Prisma, RequestPriority } from "@prisma/client";
import { db } from "@/server/db";
import { compatibleDonorGroups, type BloodGroupCode } from "@/lib/blood";
import { distanceKm, hasCoords } from "@/lib/geo";
import { allLocations, areaIdsWithin, type LocationNode } from "@/server/services/locations";
import { getSettings } from "@/server/settings";

// Deterministic, explainable matching. It only helps locate potentially relevant
// volunteers — it is not a medical compatibility decision.

export type MatchCandidate = {
  userId: string;
  name: string;
  bloodGroup: BloodGroupCode;
  locationId: string | null;
  availability: string;
  emergencyAvailable: boolean;
  lastActiveAt: Date;
  distanceKm: number | null;
  sameArea: boolean;
  sameDistrict: boolean;
  exactGroup: boolean;
  score: number;
};

/** Base filter: donors who are active, verified, visible, available and past their donation interval. */
export function eligibleDonorWhere(intervalDays: number, now = new Date()): Prisma.DonorProfileWhereInput {
  const cutoff = new Date(now.getTime() - intervalDays * 86_400_000);
  return {
    availability: "AVAILABLE",
    showInSearch: true,
    OR: [{ lastDonationDate: null }, { lastDonationDate: { lte: cutoff } }],
    AND: [{ OR: [{ nextAvailableDate: null }, { nextAvailableDate: { lte: now } }] }],
    user: {
      status: "ACTIVE",
      deletedAt: null,
      OR: [{ emailVerifiedAt: { not: null } }, { phoneVerifiedAt: { not: null } }],
    },
  };
}

export function scoreCandidate(c: Omit<MatchCandidate, "score">, now = new Date()) {
  let score = 0;
  if (c.sameArea) score += 40;
  else if (c.sameDistrict) score += 20;
  if (c.distanceKm != null) score += Math.max(0, 20 - c.distanceKm * 2);
  if (c.exactGroup) score += 15; // conserve universal donors for when they are truly needed
  const daysSinceActive = (now.getTime() - c.lastActiveAt.getTime()) / 86_400_000;
  if (daysSinceActive <= 7) score += 10;
  else if (daysSinceActive <= 30) score += 5;
  if (c.emergencyAvailable) score += 5;
  return Math.round(score * 10) / 10;
}

type FindOpts = {
  bloodGroup: BloodGroupCode;
  locationId: string; // request area
  priority: RequestPriority;
  radiusKm?: number; // when set, restrict to donors whose area centroid is within radius
  excludeUserIds?: string[];
  limit?: number;
};

export async function findMatches(opts: FindOpts): Promise<{ candidates: MatchCandidate[]; expanded: boolean }> {
  const settings = await getSettings();
  const locs = await allLocations();
  const byId = new Map(locs.map((l) => [l.id, l]));
  const area = byId.get(opts.locationId);
  if (!area) return { candidates: [], expanded: false };
  const districtId = area.type === "AREA" ? area.parentId : area.id;

  const pickAreas = (radius: number | undefined) => {
    const ids = new Set<string>();
    for (const l of locs) {
      if (l.type !== "AREA") continue;
      if (l.parentId === districtId) ids.add(l.id);
      if (radius != null && hasCoords(area) && hasCoords(l) && distanceKm(area, l) <= radius) ids.add(l.id);
    }
    ids.add(area.id);
    return ids;
  };

  const run = async (radius: number | undefined) => {
    const areaIds = [...pickAreas(radius)];
    const where: Prisma.DonorProfileWhereInput = {
      ...eligibleDonorWhere(settings.donationIntervalDays),
      bloodGroup: { in: compatibleDonorGroups(opts.bloodGroup) },
      locationId: { in: areaIds },
      userId: opts.excludeUserIds?.length ? { notIn: opts.excludeUserIds } : undefined,
      ...(opts.priority === "EMERGENCY" ? { emergencyAvailable: true } : {}),
    };
    const rows = await db.donorProfile.findMany({
      where,
      take: 500,
      select: {
        userId: true,
        bloodGroup: true,
        locationId: true,
        availability: true,
        emergencyAvailable: true,
        user: { select: { name: true, lastActiveAt: true } },
      },
    });
    return rows.map((r) => {
      const loc = r.locationId ? byId.get(r.locationId) : undefined;
      const d = loc && hasCoords(loc) && hasCoords(area) ? distanceKm(area, loc) : null;
      const base = {
        userId: r.userId,
        name: r.user.name,
        bloodGroup: r.bloodGroup as BloodGroupCode,
        locationId: r.locationId,
        availability: r.availability,
        emergencyAvailable: r.emergencyAvailable,
        lastActiveAt: r.user.lastActiveAt,
        distanceKm: d == null ? null : Math.round(d * 10) / 10,
        sameArea: r.locationId === area.id,
        sameDistrict: !!loc && loc.parentId === districtId,
        exactGroup: r.bloodGroup === opts.bloodGroup,
      };
      return { ...base, score: scoreCandidate(base) };
    });
  };

  let expanded = false;
  let candidates = await run(undefined);
  if (opts.radiusKm != null) {
    const within = candidates.filter((c) => c.sameArea || (c.distanceKm != null && c.distanceKm <= opts.radiusKm!));
    if (within.length > 0) candidates = within;
    else expanded = candidates.length > 0; // nobody inside the radius → fall back to the whole district
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { candidates: candidates.slice(0, opts.limit ?? 50), expanded };
}

export function districtOf(locs: LocationNode[], locationId: string | null) {
  const l = locs.find((x) => x.id === locationId);
  return l?.type === "AREA" ? l.parentId : l?.id ?? null;
}

export { areaIdsWithin };
