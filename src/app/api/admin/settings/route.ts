import { handler, ok, parseJson, clientIp, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { getSettings, saveSettings, settingsSchema } from "@/server/settings";
import { audit } from "@/server/audit";

export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok(await getSettings());
});

export const PATCH = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const patch = await parseJson(req, settingsSchema.partial());
  if (patch.criticalStockUnits != null && patch.lowStockUnits != null && patch.criticalStockUnits >= patch.lowStockUnits) {
    throw new ApiError(422, "VALIDATION_ERROR", "Critical threshold must be lower than the low threshold.", { criticalStockUnits: "Must be lower than low threshold" });
  }
  const next = await saveSettings(patch);
  await audit({ actorId: admin.id, action: "admin.settings_update", entityType: "AppSetting", entityId: "app", ip: clientIp(req), meta: patch });
  return ok(next);
});
