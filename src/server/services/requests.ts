import "server-only";
import type { BloodRequest, Prisma, RequestStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { getSettings } from "@/server/settings";
import { findMatches } from "@/server/services/matching";
import { assertAreaLocation, locationLabel } from "@/server/services/locations";
import { bloodLabel, canDonate, type BloodGroupCode } from "@/lib/blood";
import { canTransition, isActive, ACTIVE_STATUSES, type RequestStatusCode } from "@/lib/lifecycle";
import type { z } from "zod";
import type { bloodRequestSchema } from "@/lib/validation";

type Actor = { id: string; role: Role; emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; hospitalId?: string | null };
type Tx = Prisma.TransactionClient;

async function setStatus(tx: Tx, req: Pick<BloodRequest, "id" | "status">, to: RequestStatus, actorId: string | null, note?: string) {
  if (req.status === to) return;
  if (!canTransition(req.status as RequestStatusCode, to as RequestStatusCode)) {
    throw new ApiError(409, "BAD_TRANSITION", `A ${req.status.toLowerCase()} request cannot move to ${to.toLowerCase()}.`);
  }
  await tx.bloodRequest.update({
    where: { id: req.id },
    data: { status: to, closedAt: ["CLOSED", "CANCELLED", "EXPIRED", "FULFILLED"].includes(to) ? new Date() : null },
  });
  await tx.requestStatusEvent.create({ data: { requestId: req.id, fromStatus: req.status, toStatus: to, actorId, note } });
  req.status = to;
}

export function canManageRequest(user: { id: string; role: Role; hospitalId?: string | null }, r: { requesterId: string; hospitalId: string | null }) {
  if (user.role === "ADMIN") return true;
  if (r.requesterId === user.id) return true;
  return user.role === "HOSPITAL" && !!user.hospitalId && r.hospitalId === user.hospitalId;
}

// ───────────────────────────── Create ─────────────────────────────

export async function createBloodRequest(actor: Actor, input: z.infer<typeof bloodRequestSchema>) {
  const settings = await getSettings();
  if (!(await assertAreaLocation(input.locationId))) {
    throw new ApiError(422, "VALIDATION_ERROR", "Select the hospital's area.", { locationId: "Select an area" });
  }
  if (input.neededAt.getTime() < Date.now() - 60 * 60_000) {
    throw new ApiError(422, "VALIDATION_ERROR", "The needed date is in the past.", { neededAt: "Choose a future date/time" });
  }
  if (input.contactPreference !== "IN_APP" && !input.contactPhone) {
    throw new ApiError(422, "VALIDATION_ERROR", "Add a contact phone or choose in-app contact.", { contactPhone: "Required for phone contact" });
  }

  const verified = !!(actor.emailVerifiedAt || actor.phoneVerifiedAt);
  const activeCount = await db.bloodRequest.count({ where: { requesterId: actor.id, status: { in: ACTIVE_STATUSES } } });
  if (!verified && activeCount >= settings.maxOpenRequestsUnverified) {
    throw new ApiError(403, "UNVERIFIED_LIMIT", "Verify your email or phone to post more requests.");
  }

  // Duplicate guard: same group + hospital still active in the last 12h.
  const dup = await db.bloodRequest.findFirst({
    where: {
      requesterId: actor.id,
      bloodGroup: input.bloodGroup,
      hospitalName: input.hospitalName,
      status: { in: [...ACTIVE_STATUSES, "DRAFT"] },
      createdAt: { gte: new Date(Date.now() - 12 * 3_600_000) },
    },
    select: { id: true },
  });
  if (dup) throw new ApiError(409, "DUPLICATE_REQUEST", "You already have an active request for this. Update it instead.", { requestId: dup.id });

  let hospitalId = input.hospitalId ?? null;
  if (actor.role === "HOSPITAL" && actor.hospitalId) hospitalId = actor.hospitalId;
  if (hospitalId && !(await db.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } }))) hospitalId = null;

  const status: RequestStatus = input.saveAsDraft ? "DRAFT" : "OPEN";
  const request = await db.$transaction(async (tx) => {
    const r = await tx.bloodRequest.create({
      data: {
        requesterId: actor.id,
        hospitalId,
        bloodGroup: input.bloodGroup,
        units: input.units,
        patientName: input.patientName,
        hospitalName: input.hospitalName,
        hospitalAddress: input.hospitalAddress ?? null,
        locationId: input.locationId,
        neededAt: input.neededAt,
        priority: input.priority,
        status,
        notes: input.notes ?? null,
        contactPreference: input.contactPreference,
        contactPhone: input.contactPhone ?? null,
      },
    });
    await tx.requestStatusEvent.create({ data: { requestId: r.id, toStatus: status, actorId: actor.id, note: "Request created" } });
    return r;
  });

  await audit({ actorId: actor.id, action: "request.create", entityType: "BloodRequest", entityId: request.id, meta: { priority: request.priority } });

  let autoNotified = 0;
  if (status === "OPEN" && request.priority !== "NORMAL") {
    autoNotified = await autoNotifyDonors(request.id, actor.id);
  }
  return { request, autoNotified };
}

export async function publishDraft(actor: Actor, requestId: string) {
  const r = await getManageable(actor, requestId);
  await db.$transaction((tx) => setStatus(tx, r, "OPEN", actor.id, "Published"));
  if (r.priority !== "NORMAL") await autoNotifyDonors(r.id, actor.id);
}

/**
 * Urgent / emergency: notify eligible compatible donors whose area is within the
 * configured radius (falls back to the whole district if nobody is inside it).
 */
export async function autoNotifyDonors(requestId: string, actorId: string | null) {
  const settings = await getSettings();
  const r = await db.bloodRequest.findUnique({ where: { id: requestId }, include: { donationRequests: { select: { donorId: true } } } });
  if (!r || !isActive(r.status)) return 0;

  const { candidates, expanded } = await findMatches({
    bloodGroup: r.bloodGroup as BloodGroupCode,
    locationId: r.locationId,
    priority: r.priority,
    radiusKm: settings.emergencyRadiusKm,
    excludeUserIds: [r.requesterId, ...r.donationRequests.map((d) => d.donorId)],
    limit: settings.maxAutoNotify,
  });

  await db.$transaction(async (tx) => {
    await tx.bloodRequest.update({ where: { id: r.id }, data: { matchRadiusKm: expanded ? null : settings.emergencyRadiusKm } });
    if (r.status === "OPEN") await setStatus(tx, r, "MATCHING", actorId, `Auto-matching (${candidates.length} donors found${expanded ? ", expanded to district" : ""})`);
  });
  if (candidates.length === 0) {
    await notify([
      {
        userId: r.requesterId,
        type: "REQUEST_STATUS",
        title: "No matching donors nearby yet",
        message: `We couldn't find available ${bloodLabel(r.bloodGroup)}-compatible donors near ${r.hospitalName}. Try searching a wider area or call the hotline.`,
        link: `/requests/${r.id}`,
        bloodRequestId: r.id,
      },
    ]);
    return 0;
  }
  return sendDonationRequests(r, candidates.map((c) => ({ donorId: c.userId, distanceKm: c.distanceKm })), actorId, "AUTO_MATCH");
}

async function sendDonationRequests(
  r: BloodRequest,
  targets: { donorId: string; distanceKm: number | null }[],
  actorId: string | null,
  source: "DIRECT" | "AUTO_MATCH",
  message?: string,
) {
  const area = await locationLabel(r.locationId);
  const created: { id: string; donorId: string }[] = [];
  await db.$transaction(async (tx) => {
    for (const t of targets) {
      const existing = await tx.donationRequest.findUnique({ where: { bloodRequestId_donorId: { bloodRequestId: r.id, donorId: t.donorId } } });
      if (existing) continue;
      const dr = await tx.donationRequest.create({
        data: { bloodRequestId: r.id, donorId: t.donorId, source, message: message ?? null, distanceKm: t.distanceKm },
      });
      created.push({ id: dr.id, donorId: t.donorId });
    }
    if (created.length > 0 && ["OPEN", "MATCHING"].includes(r.status)) {
      await setStatus(tx, r, "DONOR_CONTACTED", actorId, `${created.length} donor(s) contacted`);
    }
  });

  const emergency = r.priority === "EMERGENCY";
  const title = emergency ? "Emergency blood request" : r.priority === "URGENT" ? "Urgent blood request" : "Blood donation request";
  await notify(
    created.map((c) => ({
      userId: c.donorId,
      type: emergency ? "EMERGENCY_ALERT" : "DONATION_REQUEST",
      title,
      message: `${bloodLabel(r.bloodGroup)} needed at ${r.hospitalName}${area ? `, ${area}` : ""}. Respond to this request.`,
      link: `/incoming/${c.id}`,
      bloodRequestId: r.id,
      donationRequestId: c.id,
    })),
    { push: true, sms: r.priority !== "NORMAL", urgent: r.priority !== "NORMAL" },
  );
  return created.length;
}

/** Requester explicitly asks specific donors (from search / match list). */
export async function requestDonors(actor: Actor, requestId: string, donorIds: string[], message?: string) {
  const r = await getManageable(actor, requestId);
  if (!isActive(r.status)) throw new ApiError(409, "INACTIVE", "This request is no longer active.");
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.donationIntervalDays * 86_400_000);
  const donors = await db.donorProfile.findMany({
    where: {
      userId: { in: donorIds.filter((d) => d !== r.requesterId) },
      availability: { not: "NOT_AVAILABLE" },
      showInSearch: true,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: { userId: true, bloodGroup: true, lastDonationDate: true },
  });
  const valid = donors.filter((d) => canDonate(d.bloodGroup as BloodGroupCode, r.bloodGroup as BloodGroupCode) && (!d.lastDonationDate || d.lastDonationDate <= cutoff));
  if (valid.length === 0) throw new ApiError(422, "NO_VALID_DONORS", "None of the selected donors can currently be requested for this blood group.");
  if (r.status === "OPEN") await db.$transaction((tx) => setStatus(tx, r, "MATCHING", actor.id, "Requester searching donors"));
  const sent = await sendDonationRequests(r, valid.map((d) => ({ donorId: d.userId, distanceKm: null })), actor.id, "DIRECT", message);
  return { sent, skipped: donorIds.length - sent };
}

// ─────────────────────────── Donor response ───────────────────────────

export async function respondToDonationRequest(donorId: string, donationRequestId: string, action: "ACCEPT" | "DECLINE") {
  const dr = await db.donationRequest.findUnique({ where: { id: donationRequestId }, include: { bloodRequest: true } });
  if (!dr || dr.donorId !== donorId) throw new ApiError(404, "NOT_FOUND", "Request not found.");
  if (dr.status !== "PENDING") {
    if ((dr.status === "ACCEPTED" && action === "ACCEPT") || (dr.status === "DECLINED" && action === "DECLINE")) return dr; // idempotent
    throw new ApiError(409, "ALREADY_RESPONDED", dr.status === "CANCELLED" ? "This request was withdrawn — it's no longer needed." : "You have already responded to this request.");
  }
  const r = dr.bloodRequest;
  if (!isActive(r.status)) {
    await db.donationRequest.update({ where: { id: dr.id }, data: { status: "CANCELLED" } });
    throw new ApiError(409, "INACTIVE", "This blood request is no longer active. Thank you for responding!");
  }

  const donor = await db.user.findUnique({ where: { id: donorId }, select: { name: true } });

  if (action === "DECLINE") {
    await db.$transaction(async (tx) => {
      await tx.donationRequest.update({ where: { id: dr.id }, data: { status: "DECLINED", respondedAt: new Date() } });
      const remaining = await tx.donationRequest.count({ where: { bloodRequestId: r.id, status: { in: ["PENDING", "ACCEPTED"] } } });
      if (remaining === 0 && r.status === "DONOR_CONTACTED") await setStatus(tx, r, "MATCHING", null, "All contacted donors declined");
    });
    await notify([
      {
        userId: r.requesterId,
        type: "REQUEST_DECLINED",
        title: "A donor declined",
        message: `A donor is unable to help with your ${bloodLabel(r.bloodGroup)} request. We'll keep it open — you can contact more donors.`,
        link: `/requests/${r.id}`,
        bloodRequestId: r.id,
      },
    ]);
    return { ...dr, status: "DECLINED" as const };
  }

  // ACCEPT
  const result = await db.$transaction(async (tx) => {
    await tx.donationRequest.update({ where: { id: dr.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    if (r.status !== "DONOR_ACCEPTED") await setStatus(tx, r, "DONOR_ACCEPTED", donorId, `${donor?.name ?? "A donor"} accepted`);
    const accepted = await tx.donationRequest.count({ where: { bloodRequestId: r.id, status: { in: ["ACCEPTED", "DONATED"] } } });
    // Enough donors for the required units → release the rest so nobody travels unnecessarily.
    let released: string[] = [];
    if (accepted >= r.units) {
      const pending = await tx.donationRequest.findMany({ where: { bloodRequestId: r.id, status: "PENDING" }, select: { id: true, donorId: true } });
      if (pending.length) {
        await tx.donationRequest.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "CANCELLED" } });
        released = pending.map((p) => p.donorId);
      }
    }
    return { accepted, released };
  });

  await notify(
    [
      {
        userId: r.requesterId,
        type: "REQUEST_ACCEPTED",
        title: "A donor accepted your request",
        message: `${donor?.name ?? "A donor"} accepted your ${bloodLabel(r.bloodGroup)} request (${result.accepted}/${r.units} units). Open the request to see contact details.`,
        link: `/requests/${r.id}`,
        bloodRequestId: r.id,
      },
    ],
    { push: true, sms: r.priority !== "NORMAL", urgent: true },
  );
  if (result.released.length) {
    await notify(
      result.released.map((uid) => ({
        userId: uid,
        type: "REQUEST_CANCELLED" as const,
        title: "Request no longer needed",
        message: `Enough donors have been found for the ${bloodLabel(r.bloodGroup)} request at ${r.hospitalName}. Thank you!`,
        link: `/incoming`,
        bloodRequestId: r.id,
      })),
    );
  }
  return { ...dr, status: "ACCEPTED" as const };
}

// ───────────────────────── Requester actions ─────────────────────────

async function getManageable(actor: Actor, requestId: string) {
  const r = await db.bloodRequest.findUnique({ where: { id: requestId } });
  if (!r) throw new ApiError(404, "NOT_FOUND", "Request not found.");
  if (!canManageRequest(actor, r)) throw new ApiError(403, "FORBIDDEN", "You cannot manage this request.");
  return r;
}

async function releaseDonors(requestId: string, reason: "CANCELLED" | "FULFILLED" | "EXPIRED", r: BloodRequest) {
  const affected = await db.donationRequest.findMany({ where: { bloodRequestId: requestId, status: { in: ["PENDING", "ACCEPTED"] } } });
  if (!affected.length) return;
  await db.donationRequest.updateMany({
    where: { id: { in: affected.map((a) => a.id) } },
    data: { status: reason === "EXPIRED" ? "EXPIRED" : "CANCELLED" },
  });
  const title = reason === "FULFILLED" ? "Request fulfilled" : reason === "EXPIRED" ? "Request expired" : "Request cancelled";
  const message =
    reason === "FULFILLED"
      ? `The ${bloodLabel(r.bloodGroup)} request at ${r.hospitalName} has been fulfilled. Thank you for your kindness!`
      : `The ${bloodLabel(r.bloodGroup)} request at ${r.hospitalName} is no longer active. No action is needed.`;
  await notify(affected.map((a) => ({ userId: a.donorId, type: "REQUEST_CANCELLED" as const, title, message, link: `/incoming`, bloodRequestId: r.id })));
}

export async function actOnRequest(actor: Actor, requestId: string, action: "PUBLISH" | "CANCEL" | "FULFILL" | "CLOSE" | "REOPEN", opts: { note?: string; unitsFulfilled?: number } = {}) {
  const r = await getManageable(actor, requestId);
  switch (action) {
    case "PUBLISH":
      await publishDraft(actor, requestId);
      break;
    case "CANCEL":
      await db.$transaction((tx) => setStatus(tx, r, "CANCELLED", actor.id, opts.note ?? "Cancelled by requester"));
      await releaseDonors(r.id, "CANCELLED", r);
      break;
    case "FULFILL": {
      await db.$transaction(async (tx) => {
        await setStatus(tx, r, "FULFILLED", actor.id, opts.note ?? "Marked fulfilled");
        await tx.bloodRequest.update({ where: { id: r.id }, data: { unitsFulfilled: opts.unitsFulfilled ?? r.units } });
        await tx.donationRequest.updateMany({ where: { bloodRequestId: r.id, status: "ACCEPTED" }, data: { status: "DONATED" } });
      });
      await releaseDonors(r.id, "FULFILLED", r);
      break;
    }
    case "CLOSE":
      await db.$transaction((tx) => setStatus(tx, r, "CLOSED", actor.id, opts.note ?? "Closed"));
      break;
    case "REOPEN":
      if (r.status !== "EXPIRED") throw new ApiError(409, "BAD_TRANSITION", "Only expired requests can be reopened.");
      await db.$transaction(async (tx) => {
        await setStatus(tx, r, "OPEN", actor.id, "Reopened");
        await tx.bloodRequest.update({ where: { id: r.id }, data: { neededAt: new Date(Date.now() + 24 * 3_600_000), closedAt: null } });
      });
      break;
  }
  await audit({ actorId: actor.id, action: `request.${action.toLowerCase()}`, entityType: "BloodRequest", entityId: r.id });
  return db.bloodRequest.findUnique({ where: { id: r.id } });
}

/** Called by the scheduler and lazily on reads. */
export async function expireStaleRequests(now = new Date()) {
  const settings = await getSettings();
  const cutoff = new Date(now.getTime() - settings.requestExpiryHours * 3_600_000);
  const stale = await db.bloodRequest.findMany({ where: { status: { in: ACTIVE_STATUSES }, neededAt: { lt: cutoff } } });
  for (const r of stale) {
    await db.$transaction((tx) => setStatus(tx, r, "EXPIRED", null, "Needed time passed"));
    await releaseDonors(r.id, "EXPIRED", r);
    await notify([
      {
        userId: r.requesterId,
        type: "REQUEST_STATUS",
        title: "Your request expired",
        message: `Your ${bloodLabel(r.bloodGroup)} request at ${r.hospitalName} expired. You can reopen it if blood is still needed.`,
        link: `/requests/${r.id}`,
        bloodRequestId: r.id,
      },
    ]);
  }
  // Fulfilled requests auto-close after 7 days.
  const toClose = await db.bloodRequest.findMany({ where: { status: "FULFILLED", closedAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } });
  for (const r of toClose) await db.$transaction((tx) => setStatus(tx, r, "CLOSED", null, "Auto-closed"));
  return stale.length;
}

/** Contact info revealed to a requester only for donors who accepted, per the donor's privacy settings. */
export async function acceptedDonorContacts(requestId: string) {
  const rows = await db.donationRequest.findMany({
    where: { bloodRequestId: requestId, status: { in: ["ACCEPTED", "DONATED"] } },
    select: {
      id: true,
      status: true,
      respondedAt: true,
      donor: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          donorProfile: { select: { bloodGroup: true, sharePhoneAfterAccept: true, shareEmailAfterAccept: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    donationRequestId: r.id,
    status: r.status,
    respondedAt: r.respondedAt,
    donorId: r.donor.id,
    name: r.donor.name,
    bloodGroup: r.donor.donorProfile?.bloodGroup ?? null,
    phone: r.donor.donorProfile?.sharePhoneAfterAccept ? r.donor.phone : null,
    email: r.donor.donorProfile?.shareEmailAfterAccept ? r.donor.email : null,
  }));
}
