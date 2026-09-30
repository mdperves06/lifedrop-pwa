import { z } from "zod";
import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { normalizePhone } from "@/lib/validation";
import { audit } from "@/server/audit";

// Staff registers a walk-in donor (who must already have an account) at their center.
export const POST = handler(async (req) => {
  const staff = await requireRole("CENTER_STAFF", "ADMIN");
  const { identifier, centerId } = await parseJson(req, z.object({ identifier: z.string().trim().min(3).max(160), centerId: z.string().max(40).optional() }));
  const cid = staff.role === "CENTER_STAFF" ? staff.centerId : centerId;
  if (!cid) throw new ApiError(422, "VALIDATION_ERROR", "Select a center.");
  const id = identifier.toLowerCase();
  const donor = await db.user.findFirst({
    where: { status: "ACTIVE", ...(id.includes("@") ? { email: id } : { phone: normalizePhone(identifier) }) },
    select: { id: true, name: true, donorProfile: { select: { bloodGroup: true } } },
  });
  if (!donor) throw new ApiError(404, "NOT_FOUND", "No donor found with that email or phone. Ask them to register first.");
  const active = await db.appointment.findFirst({ where: { donorId: donor.id, status: { in: ["BOOKED", "CHECKED_IN"] } } });
  if (active) {
    if (active.centerId === cid) {
      await db.appointment.update({ where: { id: active.id }, data: { status: "CHECKED_IN" } });
      return ok({ appointmentId: active.id, donor: donor.name, existing: true });
    }
    throw new ApiError(409, "HAS_APPOINTMENT", "This donor has an upcoming appointment at another center.");
  }
  const appt = await db.appointment.create({ data: { donorId: donor.id, centerId: cid, startsAt: new Date(), isWalkIn: true, status: "CHECKED_IN" } });
  await audit({ actorId: staff.id, action: "appointment.walk_in", entityType: "Appointment", entityId: appt.id });
  return ok({ appointmentId: appt.id, donor: donor.name, existing: false }, 201);
});
