export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function hasCoords(v: { lat?: number | null; lng?: number | null } | null | undefined): v is LatLng {
  return !!v && typeof v.lat === "number" && typeof v.lng === "number";
}
