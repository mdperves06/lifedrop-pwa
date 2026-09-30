import "server-only";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { getSettings } from "@/server/settings";
import { ageFromDob, checkEligibility, type EligibilityIssue } from "@/lib/eligibility";
import { bookableHours, liveStatus } from "@/server/services/centers";
import { formatDateTime, localParts } from "@/lib/time";

export const ACTIVE_APPT = ["BOOKED", "CHECKED_IN"] as const;

/** Pre-booking checks. General guidance only — the center's medical screening decides. */
export async function donorEligibility(userId: string, at = new Date()) {
  const settings = await getSettings();
  const user = await db.user.findUnique({ where: { id: userId }, include: { donorProfile: true } });
  if (!user?.donorProfile) return { eligible: false, issues: ["NO_PROFILE"] as (EligibilityIssue | "NO_PROFILE" | "NO_HEALTH_DECLARATION")[], nextEligibleDate: null };
  const res = checkEligibility(
    { age: ageFromDob(user.dateOfBirth, at), weightKg: user.donorProfile.weightKg, lastDonationDate: user.donorProfile.lastDonationDate },
    { intervalDays: settings.donationIntervalDays, now: at, requireAll: true },
  );
  const issues: (EligibilityIssue | "NO_PROFILE" | "NO_HEALTH_DECLARATION")[] = [...res.issues];
  if (!user.donorProfile.healthDeclarationOk) issues.push("NO_HEALTH_DECLARATION");
  return { eligible: issues.length === 0, issues, nextEligibleDate: res.nextEligibleDate };
}

async function assertSlot(centerId: string, startsAt: Date, excludeId?: string) {
  const center = await db.center.findUnique({ where: { id: centerId } });
  if (!center || !center.isActive) throw new ApiError(404, "NOT_FOUND", "Center not found.");
  if (center.statusOverride === "CLOSED") throw new ApiError(409, "CENTER_CLOSED", "This center is temporarily closed for bookings.");
  const p = localParts(startsAt);
  if (p.min !== 0 || !bookableHours(center, p.dow).includes(p.h)) throw new ApiError(422, "BAD_SLOT", "That time is not an available slot at this center.");
  if (startsAt.getTime() <= Date.now()) throw new ApiError(422, "BAD_SLOT", "That slot has already started.");
  if (startsAt.getTime() > Date.now() + 60 * 86_400_000) throw new ApiError(422, "BAD_SLOT", "You can book up to 60 days ahead.");
  const used = await db.appointment.count({
    where: { centerId, startsAt, status: { in: [...ACTIVE_APPT, "COMPLETED"] }, isWalkIn: false, id: excludeId ? { not: excludeId } : undefined },
  });
  if (used >= center.capacityPerSlot) throw new ApiError(409, "SLOT_FULL", "That slot just filled up. Please choose another time.");
  return center;
}

export async function bookAppointment(userId: string, input: { centerId: string; startsAt: Date; notes?: string; campaignId?: string | null; walkIn?: boolean }) {
  const elig = await donorEligibility(userId, input.walkIn ? new Date() : input.startsAt);
  if (!elig.eligible) {
    throw new ApiError(422, "NOT_ELIGIBLE", "Based on your profile you may not be able to donate at that time.", { issues: elig.issues, nextEligibleDate: elig.nextEligibleDate });
  }
  const existing = await db.appointment.findFirst({ where: { donorId: userId, status: { in: [...ACTIVE_APPT] } } });
  if (existing) throw new ApiError(409, "HAS_APPOINTMENT", "You already have an upcoming appointment. Reschedule or cancel it first.", { appointmentId: existing.id });

  let startsAt = input.startsAt;
  let center;
  if (input.walkIn) {
    center = await db.center.findUnique({ where: { id: input.centerId } });
    if (!center || !center.isActive) throw new ApiError(404, "NOT_FOUND", "Center not found.");
    const status = await liveStatus(center);
    if (status === "CLOSED") throw new ApiError(409, "CENTER_CLOSED", "This center is closed right now. Please book a slot instead.");
    startsAt = new Date();
  } else {
    center = await assertSlot(input.centerId, startsAt);
  }

  const appt = await db.appointment.create({
    data: { donorId: userId, centerId: center.id, startsAt, notes: input.notes, isWalkIn: !!input.walkIn, campaignId: input.campaignId ?? null, status: input.walkIn ? "CHECKED_IN" : "BOOKED" },
  });
  await notify([
    {
      userId,
      type: "APPOINTMENT_UPDATE",
      title: input.walkIn ? "Walk-in registered" : "Appointment confirmed",
      message: input.walkIn
        ? `You're checked in as a walk-in at ${center.name}. Please go to the reception desk.`
        : `${center.name} — ${formatDateTime(startsAt)}. We'll remind you 24 hours and 1 hour before.`,
      link: `/appointments`,
    },
  ], { push: true, email: true });
  await audit({ actorId: userId, action: "appointment.book", entityType: "Appointment", entityId: appt.id });
  return appt;
}

async function getOwned(userId: string, id: string, role: string, centerId?: string | null) {
  const appt = await db.appointment.findUnique({ where: { id }, include: { center: true } });
  if (!appt) throw new ApiError(404, "NOT_FOUND", "Appointment not found.");
  const allowed = appt.donorId === userId || role === "ADMIN" || (role === "CENTER_STAFF" && centerId === appt.centerId);
  if (!allowed) throw new ApiError(403, "FORBIDDEN", "You cannot change this appointment.");
  return appt;
}

export async function cancelAppointment(actor: { id: string; role: string; centerId?: string | null }, id: string, reason?: string) {
  const appt = await getOwned(actor.id, id, actor.role, actor.centerId);
  if (appt.status !== "BOOKED" && appt.status !== "CHECKED_IN") throw new ApiError(409, "BAD_STATE", "This appointment can no longer be cancelled.");
  await db.appointment.update({ where: { id }, data: { status: "CANCELLED", cancelledReason: reason ?? (actor.id === appt.donorId ? "Cancelled by donor" : "Cancelled by staff") } });
  if (actor.id !== appt.donorId) {
    await notify([{ userId: appt.donorId, type: "APPOINTMENT_UPDATE", title: "Appointment cancelled", message: `Your appointment at ${appt.center.name} on ${formatDateTime(appt.startsAt)} was cancelled${reason ? `: ${reason}` : ""}.`, link: "/appointments" }], { push: true, email: true });
  }
  await audit({ actorId: actor.id, action: "appointment.cancel", entityType: "Appointment", entityId: id, meta: { reason } });
}

export async function rescheduleAppointment(actor: { id: string; role: string; centerId?: string | null }, id: string, startsAt: Date) {
  const appt = await getOwned(actor.id, id, actor.role, actor.centerId);
  if (appt.status !== "BOOKED") throw new ApiError(409, "BAD_STATE", "Only upcoming appointments can be rescheduled.");
  const elig = await donorEligibility(appt.donorId, startsAt);
  if (!elig.eligible) throw new ApiError(422, "NOT_ELIGIBLE", "You may not be eligible to donate at that time.", { issues: elig.issues, nextEligibleDate: elig.nextEligibleDate });
  await assertSlot(appt.centerId, startsAt, id);
  const updated = await db.appointment.update({ where: { id }, data: { startsAt, reminder24SentAt: null, reminder1SentAt: null } });
  await notify([{ userId: appt.donorId, type: "APPOINTMENT_UPDATE", title: "Appointment rescheduled", message: `${appt.center.name} — ${formatDateTime(startsAt)}.`, link: "/appointments" }], { push: true, email: true });
  await audit({ actorId: actor.id, action: "appointment.reschedule", entityType: "Appointment", entityId: id });
  return updated;
}

export async function setAppointmentStatus(actor: { id: string; role: string; centerId?: string | null }, id: string, status: "CHECKED_IN" | "NO_SHOW") {
  if (actor.role !== "ADMIN" && actor.role !== "CENTER_STAFF") throw new ApiError(403, "FORBIDDEN", "Staff only.");
  const appt = await getOwned(actor.id, id, actor.role, actor.centerId);
  if (appt.status !== "BOOKED" && !(status === "NO_SHOW" && appt.status === "CHECKED_IN")) throw new ApiError(409, "BAD_STATE", "Invalid status change.");
  await db.appointment.update({ where: { id }, data: { status } });
  await audit({ actorId: actor.id, action: `appointment.${status.toLowerCase()}`, entityType: "Appointment", entityId: id });
}

/** 24h and 1h reminders. Idempotent via reminder*SentAt. */
export async function sendAppointmentReminders(now = new Date()) {
  const in24 = new Date(now.getTime() + 24 * 3_600_000);
  const in1 = new Date(now.getTime() + 3_600_000);
  const due24 = await db.appointment.findMany({ where: { status: "BOOKED", reminder24SentAt: null, startsAt: { gt: in1, lte: in24 } }, include: { center: true } });
  const due1 = await db.appointment.findMany({ where: { status: "BOOKED", reminder1SentAt: null, startsAt: { gt: now, lte: in1 } }, include: { center: true } });
  for (const a of due24) {
    await notify([{ userId: a.donorId, type: "APPOINTMENT_REMINDER", title: "Donation tomorrow", message: `Reminder: ${a.center.name} at ${formatDateTime(a.startsAt)}. Eat well, drink water and bring an ID.`, link: "/appointments" }], { push: true, sms: true, email: true });
    await db.appointment.update({ where: { id: a.id }, data: { reminder24SentAt: now } });
  }
  for (const a of due1) {
    await notify([{ userId: a.donorId, type: "APPOINTMENT_REMINDER", title: "Donation in 1 hour", message: `See you soon at ${a.center.name} (${a.center.address}).`, link: "/appointments" }], { push: true, sms: true });
    await db.appointment.update({ where: { id: a.id }, data: { reminder1SentAt: now, reminder24SentAt: a.reminder24SentAt ?? now } });
  }
  // Past, never checked in → no-show after 3 hours.
  await db.appointment.updateMany({ where: { status: "BOOKED", startsAt: { lt: new Date(now.getTime() - 3 * 3_600_000) } }, data: { status: "NO_SHOW" } });
  return { reminders24: due24.length, reminders1: due1.length };
}
