import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { centerSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertAreaLocation } from "@/server/services/locations";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, centerSchema);
  if (!(await assertAreaLocation(input.locationId))) throw new ApiError(422, "VALIDATION_ERROR", "Select an area.", { locationId: "Select an area" });
  const c = await db.center.create({ data: { ...input, equipment: JSON.stringify(input.equipment), neededBloodGroups: input.neededBloodGroups.join(",") } });
  await audit({ actorId: admin.id, action: "admin.center_create", entityType: "Center", entityId: c.id });
  return ok({ id: c.id }, 201);
});
