import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { campaignSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, campaignSchema);
  if (input.endsAt <= input.startsAt) throw new ApiError(422, "VALIDATION_ERROR", "End must be after start.", { endsAt: "Must be after start" });
  const c = await db.campaign.create({ data: { ...input, centerId: input.centerId ?? null, createdById: admin.id } });
  await audit({ actorId: admin.id, action: "admin.campaign_create", entityType: "Campaign", entityId: c.id });
  return ok({ id: c.id }, 201);
});
