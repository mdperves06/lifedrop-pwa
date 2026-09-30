import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireUser, clearSessionCookie } from "@/server/auth/session";
import { profileUpdateSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { assertAreaLocation } from "@/server/services/locations";
import { deleteAccount } from "@/server/services/auth";
import { audit } from "@/server/audit";

export const GET = handler(async () => {
  const u = await requireUser();
  const full = await db.user.findUnique({
    where: { id: u.id },
    select: {
      id: true, name: true, email: true, phone: true, role: true, locale: true, avatarPath: true, dateOfBirth: true, gender: true,
      organization: true, note: true, locationId: true, referralCode: true, emailVerifiedAt: true, phoneVerifiedAt: true,
      donorProfile: true,
    },
  });
  return ok(full);
});

export const PATCH = handler(async (req) => {
  const u = await requireUser();
  const input = await parseJson(req, profileUpdateSchema);
  if (input.locationId && !(await assertAreaLocation(input.locationId))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Select your area.", { locationId: "Select your area" });
  }
  const phoneChanged = !!input.phone && input.phone !== u.phone;
  if (phoneChanged) {
    const taken = await db.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
    if (taken) throw new ApiError(409, "CONFLICT", "That phone number is already in use.", { phone: "Already in use" });
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: u.id }, data: { ...input, phoneVerifiedAt: phoneChanged ? null : undefined } });
    if (input.locationId) await tx.donorProfile.updateMany({ where: { userId: u.id }, data: { locationId: input.locationId } });
  });
  await audit({ actorId: u.id, action: "user.update_profile", entityType: "User", entityId: u.id, meta: { fields: Object.keys(input) } });
  return ok({ updated: true, phoneNeedsVerification: phoneChanged });
});

export const DELETE = handler(async () => {
  const u = await requireUser();
  if (u.role === "ADMIN") {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw new ApiError(409, "LAST_ADMIN", "You are the last admin. Promote someone else first.");
  }
  await deleteAccount(u.id);
  await clearSessionCookie();
  return ok({ deleted: true });
});
