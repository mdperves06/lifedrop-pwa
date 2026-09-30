import "server-only";
import { cache } from "react";
import { db } from "@/server/db";

export type LocationNode = {
  id: string;
  name: string;
  nameBn: string | null;
  type: "DIVISION" | "DISTRICT" | "AREA";
  parentId: string | null;
  lat: number | null;
  lng: number | null;
};

/** All active locations, flat. Small table (hundreds of rows) — cached per request. */
export const allLocations = cache(async (): Promise<LocationNode[]> => {
  return db.location.findMany({
    where: { isActive: true },
    select: { id: true, name: true, nameBn: true, type: true, parentId: true, lat: true, lng: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
});

export async function locationMap() {
  const all = await allLocations();
  return new Map(all.map((l) => [l.id, l]));
}

/** Returns [area, district, division] (whichever exist) for a location id. */
export async function ancestry(locationId: string | null | undefined) {
  if (!locationId) return [];
  const map = await locationMap();
  const chain: LocationNode[] = [];
  let cur = map.get(locationId);
  while (cur && chain.length < 4) {
    chain.push(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain;
}

export async function locationLabel(locationId: string | null | undefined, locale: string = "en") {
  const chain = await ancestry(locationId);
  const name = (l: LocationNode) => (locale === "bn" && l.nameBn ? l.nameBn : l.name);
  // "Area, District"
  return chain.slice(0, 2).map(name).join(", ");
}

/** Resolve a filter (division / district / area) to the set of AREA ids it covers. */
export async function areaIdsWithin(filter: { divisionId?: string; districtId?: string; areaId?: string }) {
  if (filter.areaId) return [filter.areaId];
  const all = await allLocations();
  if (filter.districtId) return all.filter((l) => l.type === "AREA" && l.parentId === filter.districtId).map((l) => l.id);
  if (filter.divisionId) {
    const districts = new Set(all.filter((l) => l.type === "DISTRICT" && l.parentId === filter.divisionId).map((l) => l.id));
    return all.filter((l) => l.type === "AREA" && l.parentId && districts.has(l.parentId)).map((l) => l.id);
  }
  return null; // no location filter
}

export async function assertAreaLocation(locationId: string) {
  const loc = await db.location.findUnique({ where: { id: locationId } });
  return !!loc && loc.isActive && loc.type === "AREA";
}
