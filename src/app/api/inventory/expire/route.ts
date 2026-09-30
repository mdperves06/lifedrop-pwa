import { z } from "zod";
import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { expireBatches } from "@/server/services/inventory";

export const POST = handler(async (req) => {
  const user = await requireRole("CENTER_STAFF", "ADMIN");
  const { batchIds } = await parseJson(req, z.object({ batchIds: z.array(z.string().max(40)).min(1).max(200).optional() }));
  if (batchIds && user.role === "CENTER_STAFF") {
    const foreign = await db.inventoryBatch.count({ where: { id: { in: batchIds }, centerId: { not: user.centerId ?? "" } } });
    if (foreign) throw new ApiError(403, "FORBIDDEN", "You can only manage your own center's stock.");
  }
  if (!batchIds && user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Only admins can run a full expiry sweep.");
  const units = await expireBatches(new Date(), user.id, batchIds);
  return ok({ expiredUnits: units });
});
