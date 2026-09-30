import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { donorProfileSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";

// Create or update the caller's donor profile (availability toggle, privacy settings…).
export const PATCH = handler(async (req) => {
  const u = await requireUser();
  const input = await parseJson(req, donorProfileSchema);
  const existing = await db.donorProfile.findUnique({ where: { userId: u.id } });
  if (!existing && !input.bloodGroup) throw new ApiError(422, "VALIDATION_ERROR", "Select your blood group.", { bloodGroup: "Required" });
  // Switching back to available clears any "next available" hold.
  if (input.nextAvailableDate === undefined && input.availability === "AVAILABLE") input.nextAvailableDate = null;
  const profile = existing
    ? await db.donorProfile.update({ where: { userId: u.id }, data: input })
    : await db.donorProfile.create({ data: { ...input, bloodGroup: input.bloodGroup!, userId: u.id, locationId: u.locationId } });
  await audit({ actorId: u.id, action: "donor.update", entityType: "DonorProfile", entityId: profile.id, meta: { fields: Object.keys(input) } });
  return ok(profile);
});
