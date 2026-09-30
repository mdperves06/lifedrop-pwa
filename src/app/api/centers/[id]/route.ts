import { z } from "zod";
import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

// Staff may change their own center's live status override; admins manage everything via /api/admin/centers.
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CENTER_STAFF", "ADMIN");
  if (user.role === "CENTER_STAFF" && user.centerId !== params.id) throw new ApiError(403, "FORBIDDEN", "You can only manage your own center.");
  const { statusOverride, neededBloodGroups } = await parseJson(
    req,
    z.object({
      statusOverride: z.enum(["AUTO", "OPEN", "CLOSED", "FULL"]).optional(),
      neededBloodGroups: z.array(z.enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "O_POS", "O_NEG", "AB_POS", "AB_NEG"])).optional(),
    }),
  );
  const c = await db.center.update({
    where: { id: params.id },
    data: { statusOverride, neededBloodGroups: neededBloodGroups?.join(",") },
  });
  await audit({ actorId: user.id, action: "center.update_status", entityType: "Center", entityId: c.id, meta: { statusOverride, neededBloodGroups } });
  return ok({ id: c.id, statusOverride: c.statusOverride });
});
