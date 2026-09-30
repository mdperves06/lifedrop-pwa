import { z } from "zod";
import { handler, ok, parseJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

// Locations are never hard-deleted (users and requests reference them) — they are deactivated instead.
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(
    req,
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      nameBn: z.string().trim().max(80).optional().nullable(),
      lat: z.coerce.number().min(-90).max(90).optional().nullable(),
      lng: z.coerce.number().min(-180).max(180).optional().nullable(),
      isActive: z.boolean().optional(),
    }),
  );
  const l = await db.location.update({ where: { id: params.id }, data: input });
  await audit({ actorId: admin.id, action: "admin.location_update", entityType: "Location", entityId: l.id, meta: input });
  return ok({ id: l.id });
});
