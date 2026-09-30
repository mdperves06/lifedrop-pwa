import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { campaignSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, campaignSchema.partial());
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new ApiError(422, "VALIDATION_ERROR", "End must be after start.", { endsAt: "Must be after start" });
  const c = await db.campaign.update({ where: { id: params.id }, data: input });
  await audit({ actorId: admin.id, action: "admin.campaign_update", entityType: "Campaign", entityId: c.id, meta: { fields: Object.keys(input) } });
  return ok({ id: c.id, status: c.status });
});
