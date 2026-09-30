import { handler, ok, ApiError, notFound } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { canManageRequest } from "@/server/services/requests";
import { findMatches } from "@/server/services/matching";
import { locationMap } from "@/server/services/locations";
import type { BloodGroupCode } from "@/lib/blood";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const r = await db.bloodRequest.findUnique({ where: { id: params.id }, include: { donationRequests: { select: { donorId: true } } } });
  if (!r) notFound("Request");
  if (!canManageRequest(user, r)) throw new ApiError(403, "FORBIDDEN", "You cannot view matches for this request.");
  const { candidates } = await findMatches({
    bloodGroup: r.bloodGroup as BloodGroupCode,
    locationId: r.locationId,
    priority: r.priority,
    excludeUserIds: [r.requesterId, ...r.donationRequests.map((d) => d.donorId)],
    limit: 30,
  });
  const locs = await locationMap();
  // Public-safe fields only.
  return ok(
    candidates.map((c) => ({
      id: c.userId,
      name: c.name,
      bloodGroup: c.bloodGroup,
      area: c.locationId ? locs.get(c.locationId)?.name ?? "" : "",
      distanceKm: c.distanceKm,
      sameArea: c.sameArea,
      emergencyAvailable: c.emergencyAvailable,
      score: c.score,
    })),
  );
});
