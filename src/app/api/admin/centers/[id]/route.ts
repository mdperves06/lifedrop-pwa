import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { centerSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { assertAreaLocation } from "@/server/services/locations";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, centerSchema.partial());
  if (input.locationId && !(await assertAreaLocation(input.locationId))) throw new ApiError(422, "VALIDATION_ERROR", "Select an area.", { locationId: "Select an area" });
  const { equipment, neededBloodGroups, ...rest } = input;
  const c = await db.center.update({
    where: { id: params.id },
    data: { ...rest, equipment: equipment ? JSON.stringify(equipment) : undefined, neededBloodGroups: neededBloodGroups?.join(",") },
  });
  await audit({ actorId: admin.id, action: "admin.center_update", entityType: "Center", entityId: c.id, meta: { fields: Object.keys(input) } });
  return ok({ id: c.id });
});
