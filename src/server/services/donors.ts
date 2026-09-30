import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { compatibleDonorGroups, type BloodGroupCode } from "@/lib/blood";
import { areaIdsWithin, locationMap } from "@/server/services/locations";
import { getSettings } from "@/server/settings";
import { nextEligibleDate } from "@/lib/eligibility";

export const PAGE_SIZE = 20;

export type DonorSearchFilters = {
  bloodGroup?: BloodGroupCode;
  compatible?: boolean; // include every donor group compatible with bloodGroup
  divisionId?: string;
  districtId?: string;
  areaId?: string;
  availableNow?: boolean;
  emergency?: boolean;
  recentlyActive?: boolean;
  page?: number;
};

/** Public-safe donor card. Never contains phone, email, exact address or coordinates. */
export type PublicDonor = {
  id: string;
  displayName: string;
  bloodGroup: BloodGroupCode;
  area: string;
  areaBn: string;
  availability: "AVAILABLE" | "TEMP_UNAVAILABLE" | "NOT_AVAILABLE";
  eligibleNow: boolean;
  emergencyAvailable: boolean;
  recentlyActive: boolean;
  verified: boolean;
};

export function publicName(fullName: string, viewerSignedIn: boolean) {
  if (viewerSignedIn) return fullName;
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

export async function searchDonors(filters: DonorSearchFilters, viewer: { signedIn: boolean; userId?: string }) {
  const settings = await getSettings();
  const now = new Date();
  const page = Math.max(1, filters.page ?? 1);
  const areaIds = await areaIdsWithin(filters);
  const intervalCutoff = new Date(now.getTime() - settings.donationIntervalDays * 86_400_000);

  const and: Prisma.DonorProfileWhereInput[] = [
    { showInSearch: true, availability: { not: "NOT_AVAILABLE" } },
    { user: { status: "ACTIVE", deletedAt: null, OR: [{ emailVerifiedAt: { not: null } }, { phoneVerifiedAt: { not: null } }] } },
  ];
  if (viewer.userId) and.push({ userId: { not: viewer.userId } });
  if (filters.bloodGroup) {
    and.push({ bloodGroup: filters.compatible ? { in: compatibleDonorGroups(filters.bloodGroup) } : filters.bloodGroup });
  }
  if (areaIds) and.push({ locationId: { in: areaIds } });
  if (filters.availableNow) {
    and.push(
      { availability: "AVAILABLE" },
      { OR: [{ lastDonationDate: null }, { lastDonationDate: { lte: intervalCutoff } }] },
      { OR: [{ nextAvailableDate: null }, { nextAvailableDate: { lte: now } }] },
    );
  }
  if (filters.emergency) and.push({ emergencyAvailable: true });
  if (filters.recentlyActive) and.push({ user: { lastActiveAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } });

  const where: Prisma.DonorProfileWhereInput = { AND: and };
  const [total, rows, locs] = await Promise.all([
    db.donorProfile.count({ where }),
    db.donorProfile.findMany({
      where,
      orderBy: [{ availability: "asc" }, { user: { lastActiveAt: "desc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        userId: true,
        bloodGroup: true,
        availability: true,
        emergencyAvailable: true,
        lastDonationDate: true,
        nextAvailableDate: true,
        locationId: true,
        user: { select: { name: true, lastActiveAt: true, emailVerifiedAt: true, phoneVerifiedAt: true } },
      },
    }),
    locationMap(),
  ]);

  const donors: PublicDonor[] = rows.map((r) => {
    const area = r.locationId ? locs.get(r.locationId) : undefined;
    const district = area?.parentId ? locs.get(area.parentId) : undefined;
    const next = nextEligibleDate(r.lastDonationDate, settings.donationIntervalDays);
    const eligibleNow =
      r.availability === "AVAILABLE" && (!next || next <= now) && (!r.nextAvailableDate || r.nextAvailableDate <= now);
    return {
      id: r.userId,
      displayName: publicName(r.user.name, viewer.signedIn),
      bloodGroup: r.bloodGroup as BloodGroupCode,
      area: [area?.name, district?.name].filter(Boolean).join(", ") || "Location not set",
      areaBn: [area?.nameBn ?? area?.name, district?.nameBn ?? district?.name].filter(Boolean).join(", ") || "এলাকা নির্ধারিত নয়",
      availability: r.availability,
      eligibleNow,
      emergencyAvailable: r.emergencyAvailable,
      recentlyActive: now.getTime() - r.user.lastActiveAt.getTime() < 30 * 86_400_000,
      verified: !!(r.user.emailVerifiedAt || r.user.phoneVerifiedAt),
    };
  });

  return { donors, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
