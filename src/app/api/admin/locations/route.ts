import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { locationSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

const PARENT_TYPE = { DIVISION: null, DISTRICT: "DIVISION", AREA: "DISTRICT" } as const;

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, locationSchema);
  const expected = PARENT_TYPE[input.type];
  if (expected) {
    const parent = input.parentId ? await db.location.findUnique({ where: { id: input.parentId } }) : null;
    if (!parent || parent.type !== expected) throw new ApiError(422, "VALIDATION_ERROR", `A ${input.type.toLowerCase()} must belong to a ${expected.toLowerCase()}.`, { parentId: "Invalid parent" });
  } else if (input.parentId) {
    throw new ApiError(422, "VALIDATION_ERROR", "Divisions cannot have a parent.", { parentId: "Must be empty" });
  }
  const l = await db.location.create({ data: { ...input, parentId: input.parentId ?? null } });
  await audit({ actorId: admin.id, action: "admin.location_create", entityType: "Location", entityId: l.id, meta: { name: l.name, type: l.type } });
  return ok({ id: l.id }, 201);
});
