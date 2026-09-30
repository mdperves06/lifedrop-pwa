import "server-only";
import { randomBytes } from "node:crypto";
import type { BloodGroup, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { audit } from "@/server/audit";
import { notify, notifyAdmins } from "@/server/notify";
import { getSettings, stockLevel } from "@/server/settings";
import { BLOOD_GROUPS, bloodLabel, canDonate, type BloodGroupCode } from "@/lib/blood";
import { addDays, localDateKey, startOfLocalDay } from "@/lib/time";

type Tx = Prisma.TransactionClient;

export async function stockByGroup(centerId?: string) {
  const now = new Date();
  const rows = await db.inventoryBatch.groupBy({
    by: ["bloodGroup"],
    where: { status: "AVAILABLE", expiresAt: { gt: now }, ...(centerId ? { centerId } : {}) },
    _sum: { units: true },
  });
  const expSoon = await db.inventoryBatch.groupBy({
    by: ["bloodGroup"],
    where: { status: "AVAILABLE", expiresAt: { gt: now, lte: addDays(now, 7) }, ...(centerId ? { centerId } : {}) },
    _sum: { units: true },
  });
  const settings = await getSettings();
  const sum = new Map(rows.map((r) => [r.bloodGroup, r._sum.units ?? 0]));
  const soon = new Map(expSoon.map((r) => [r.bloodGroup, r._sum.units ?? 0]));
  // Per-center thresholds are scaled down from the city-wide ones.
  const scale = centerId ? Math.max(1, await db.center.count({ where: { isActive: true } })) : 1;
  const thresholds = {
    lowStockUnits: Math.max(1, Math.round(settings.lowStockUnits / scale)),
    criticalStockUnits: Math.round(settings.criticalStockUnits / scale),
  };
  return BLOOD_GROUPS.map((g) => {
    const units = sum.get(g) ?? 0;
    return { bloodGroup: g, units, expiringSoon: soon.get(g) ?? 0, level: stockLevel(units, thresholds) };
  });
}

async function cityUnits(tx: Tx | typeof db, group: BloodGroup) {
  const r = await tx.inventoryBatch.aggregate({ where: { bloodGroup: group, status: "AVAILABLE", expiresAt: { gt: new Date() } }, _sum: { units: true } });
  return r._sum.units ?? 0;
}

async function alertIfCrossed(group: BloodGroup, before: number, after: number) {
  const s = await getSettings();
  const lvBefore = stockLevel(before, s);
  const lvAfter = stockLevel(after, s);
  if (lvAfter === lvBefore || lvAfter === "ADEQUATE") return;
  if (lvBefore === "CRITICAL") return; // already alerted
  await notifyAdmins(
    {
      type: "LOW_STOCK",
      title: `${lvAfter === "CRITICAL" ? "Critical" : "Low"} stock: ${bloodLabel(group)}`,
      message: `City-wide ${bloodLabel(group)} stock is ${after} unit(s) (threshold ${lvAfter === "CRITICAL" ? s.criticalStockUnits : s.lowStockUnits}). Consider a donor drive or targeted appeal.`,
      link: "/admin/inventory",
    },
    { push: true, email: lvAfter === "CRITICAL" },
  );
}

export async function adjustInventory(
  actor: { id: string; role: string; centerId?: string | null },
  input: { centerId: string; bloodGroup: BloodGroupCode; units: number; mode: "ADD" | "ISSUE" | "DISCARD"; collectedAt?: Date; note?: string; bloodRequestId?: string },
) {
  if (actor.role === "CENTER_STAFF" && actor.centerId !== input.centerId) throw new ApiError(403, "FORBIDDEN", "You can only manage your own center's stock.");
  if (actor.role !== "ADMIN" && actor.role !== "CENTER_STAFF") throw new ApiError(403, "FORBIDDEN", "Staff only.");
  const center = await db.center.findUnique({ where: { id: input.centerId } });
  if (!center) throw new ApiError(404, "NOT_FOUND", "Center not found.");
  const settings = await getSettings();
  const before = await cityUnits(db, input.bloodGroup);

  await db.$transaction(async (tx) => {
    if (input.mode === "ADD") {
      const collectedAt = input.collectedAt ?? new Date();
      const batch = await tx.inventoryBatch.create({
        data: { centerId: center.id, bloodGroup: input.bloodGroup, units: input.units, collectedAt, expiresAt: addDays(collectedAt, settings.batchShelfLifeDays) },
      });
      await tx.inventoryLog.create({ data: { centerId: center.id, bloodGroup: input.bloodGroup, change: input.units, reason: "ADJUSTMENT", batchId: batch.id, userId: actor.id, note: input.note } });
      return;
    }
    // ISSUE / DISCARD: consume first-expiring batches (FEFO).
    const batches = await tx.inventoryBatch.findMany({
      where: { centerId: center.id, bloodGroup: input.bloodGroup, status: "AVAILABLE", expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
    });
    const available = batches.reduce((s, b) => s + b.units, 0);
    if (available < input.units) throw new ApiError(409, "INSUFFICIENT_STOCK", `Only ${available} unit(s) of ${bloodLabel(input.bloodGroup)} available at this center.`);
    let remaining = input.units;
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.units, remaining);
      remaining -= take;
      const status = input.mode === "ISSUE" ? "USED" : "DISCARDED";
      if (take === b.units) {
        await tx.inventoryBatch.update({ where: { id: b.id }, data: { status, issuedToRequestId: input.bloodRequestId ?? null } });
      } else {
        await tx.inventoryBatch.update({ where: { id: b.id }, data: { units: b.units - take } });
        await tx.inventoryBatch.create({ data: { centerId: b.centerId, bloodGroup: b.bloodGroup, units: take, collectedAt: b.collectedAt, expiresAt: b.expiresAt, status, donationId: b.donationId, issuedToRequestId: input.bloodRequestId ?? null } });
      }
      await tx.inventoryLog.create({ data: { centerId: center.id, bloodGroup: input.bloodGroup, change: -take, reason: input.mode === "ISSUE" ? "ISSUE" : "DISCARD", batchId: b.id, userId: actor.id, note: input.note } });
    }
  });

  if (input.mode === "ISSUE" && input.bloodRequestId) await issueToRequest(actor.id, input.bloodRequestId, input.bloodGroup, input.units, center.name);
  const after = await cityUnits(db, input.bloodGroup);
  await alertIfCrossed(input.bloodGroup, before, after);
  await audit({ actorId: actor.id, action: `inventory.${input.mode.toLowerCase()}`, entityType: "Center", entityId: center.id, meta: { bloodGroup: input.bloodGroup, units: input.units, bloodRequestId: input.bloodRequestId } });
  return { before, after };
}

async function issueToRequest(actorId: string, requestId: string, group: BloodGroupCode, units: number, centerName: string) {
  const r = await db.bloodRequest.findUnique({ where: { id: requestId } });
  if (!r) return;
  if (!canDonate(group, r.bloodGroup as BloodGroupCode)) throw new ApiError(422, "INCOMPATIBLE", "That blood group is not compatible with the request.");
  const newFulfilled = Math.min(r.units, r.unitsFulfilled + units);
  await db.bloodRequest.update({ where: { id: r.id }, data: { unitsFulfilled: newFulfilled } });
  await db.requestStatusEvent.create({ data: { requestId: r.id, fromStatus: r.status, toStatus: r.status, actorId, note: `${units} unit(s) ${bloodLabel(group)} issued from ${centerName}` } });
  await notify([{ userId: r.requesterId, type: "REQUEST_STATUS", title: "Blood issued from inventory", message: `${units} unit(s) of ${bloodLabel(group)} issued from ${centerName} for your request (${newFulfilled}/${r.units}).`, link: `/requests/${r.id}`, bloodRequestId: r.id }], { push: true, sms: true });
}

/** Mark expired batches. Returns units expired. */
export async function expireBatches(now = new Date(), actorId?: string, batchIds?: string[]) {
  const batches = await db.inventoryBatch.findMany({
    where: batchIds ? { id: { in: batchIds }, status: "AVAILABLE" } : { status: "AVAILABLE", expiresAt: { lte: now } },
  });
  for (const b of batches) {
    // Date-expired units are already excluded from live stock, so count them back in for the
    // "before" level — otherwise stock would drop below threshold by time alone with no alert.
    const live = await cityUnits(db, b.bloodGroup);
    const before = b.expiresAt <= now ? live + b.units : live;
    await db.$transaction([
      db.inventoryBatch.update({ where: { id: b.id }, data: { status: "EXPIRED" } }),
      db.inventoryLog.create({ data: { centerId: b.centerId, bloodGroup: b.bloodGroup, change: -b.units, reason: "EXPIRED", batchId: b.id, userId: actorId ?? null } }),
    ]);
    await alertIfCrossed(b.bloodGroup, before, await cityUnits(db, b.bloodGroup));
  }
  if (actorId && batches.length) await audit({ actorId, action: "inventory.mark_expired", entityType: "InventoryBatch", meta: { batchIds: batches.map((b) => b.id) } });
  return batches.reduce((s, b) => s + b.units, 0);
}

export function certificateNumber() {
  return `LD-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Staff records a completed donation: donation row, inventory batch, donor profile, appointment. */
export async function recordDonation(
  actor: { id: string; role: string; centerId?: string | null },
  input: { appointmentId?: string; donorId: string; centerId: string; bloodGroup: BloodGroupCode; volumeMl: number; notes?: string; bloodRequestId?: string },
) {
  if (actor.role !== "ADMIN" && !(actor.role === "CENTER_STAFF" && actor.centerId === input.centerId)) throw new ApiError(403, "FORBIDDEN", "Only staff of this center can record donations.");
  const donor = await db.user.findUnique({ where: { id: input.donorId }, include: { donorProfile: true } });
  if (!donor || donor.status !== "ACTIVE") throw new ApiError(404, "NOT_FOUND", "Donor not found.");
  if (donor.donorProfile && donor.donorProfile.bloodGroup !== input.bloodGroup) {
    // Lab-confirmed group wins; keep the profile accurate.
    await db.donorProfile.update({ where: { userId: donor.id }, data: { bloodGroup: input.bloodGroup } });
  }
  const settings = await getSettings();
  const before = await cityUnits(db, input.bloodGroup);
  const now = new Date();
  const donation = await db.$transaction(async (tx) => {
    if (input.appointmentId) {
      const appt = await tx.appointment.findUnique({ where: { id: input.appointmentId } });
      if (!appt || appt.donorId !== donor.id || appt.centerId !== input.centerId) throw new ApiError(422, "BAD_APPOINTMENT", "Appointment does not match this donor/center.");
      if (appt.status === "COMPLETED" || appt.status === "CANCELLED") throw new ApiError(409, "BAD_STATE", "This appointment is already closed.");
      await tx.appointment.update({ where: { id: appt.id }, data: { status: "COMPLETED" } });
    }
    const d = await tx.donation.create({
      data: {
        donorId: donor.id,
        centerId: input.centerId,
        appointmentId: input.appointmentId ?? null,
        bloodRequestId: input.bloodRequestId ?? null,
        bloodGroup: input.bloodGroup,
        volumeMl: input.volumeMl,
        donatedAt: now,
        recordedById: actor.id,
        notes: input.notes,
        certificateNo: certificateNumber(),
      },
    });
    // Directed donations go straight to the patient; everything else joins stock.
    if (!input.bloodRequestId) {
      const batch = await tx.inventoryBatch.create({ data: { centerId: input.centerId, bloodGroup: input.bloodGroup, units: 1, collectedAt: now, expiresAt: addDays(now, settings.batchShelfLifeDays), donationId: d.id } });
      await tx.inventoryLog.create({ data: { centerId: input.centerId, bloodGroup: input.bloodGroup, change: 1, reason: "DONATION", batchId: batch.id, userId: actor.id } });
    } else {
      await tx.donationRequest.updateMany({ where: { bloodRequestId: input.bloodRequestId, donorId: donor.id, status: "ACCEPTED" }, data: { status: "DONATED" } });
      const r = await tx.bloodRequest.findUnique({ where: { id: input.bloodRequestId } });
      if (r) await tx.bloodRequest.update({ where: { id: r.id }, data: { unitsFulfilled: Math.min(r.units, r.unitsFulfilled + 1) } });
    }
    await tx.donorProfile.updateMany({ where: { userId: donor.id }, data: { lastDonationDate: now, nextAvailableDate: addDays(now, settings.donationIntervalDays) } });
    return d;
  });
  await notify([{ userId: donor.id, type: "ACCOUNT", title: "Thank you for donating!", message: `Your donation at the center has been recorded. Your certificate ${donation.certificateNo} is ready in your dashboard.`, link: "/dashboard" }], { push: true, email: true });
  if (!input.bloodRequestId) await alertIfCrossed(input.bloodGroup, before, before + 1);
  await audit({ actorId: actor.id, action: "donation.record", entityType: "Donation", entityId: donation.id });
  return donation;
}

/** Daily net change per group for the last N days, reconstructed backwards from current stock. */
export async function inventoryHistory(days = 30, centerId?: string) {
  const now = new Date();
  const start = startOfLocalDay(addDays(now, -(days - 1)));
  const logs = await db.inventoryLog.findMany({ where: { createdAt: { gte: start }, ...(centerId ? { centerId } : {}) }, select: { bloodGroup: true, change: true, createdAt: true } });
  const current = await stockByGroup(centerId);
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(localDateKey(addDays(start, i)));
  const deltas = new Map<string, number>(); // `${day}|${group}`
  for (const l of logs) {
    const k = `${localDateKey(l.createdAt)}|${l.bloodGroup}`;
    deltas.set(k, (deltas.get(k) ?? 0) + l.change);
  }
  // Walk backwards: end-of-day level for day i = current - sum(deltas after day i)
  const series: { date: string; total: number; byGroup: Record<string, number> }[] = [];
  const running: Record<string, number> = Object.fromEntries(current.map((c) => [c.bloodGroup, c.units]));
  for (let i = keys.length - 1; i >= 0; i--) {
    const byGroup = { ...running };
    series.unshift({ date: keys[i], total: Object.values(byGroup).reduce((a, b) => a + b, 0), byGroup });
    for (const g of BLOOD_GROUPS) running[g] = Math.max(0, running[g] - (deltas.get(`${keys[i]}|${g}`) ?? 0));
  }
  return series;
}

export async function donationsPerDay(days = 14, centerId?: string) {
  const start = startOfLocalDay(addDays(new Date(), -(days - 1)));
  const rows = await db.donation.findMany({ where: { donatedAt: { gte: start }, ...(centerId ? { centerId } : {}) }, select: { donatedAt: true } });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(localDateKey(r.donatedAt), (counts.get(localDateKey(r.donatedAt)) ?? 0) + 1);
  const out: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const k = localDateKey(addDays(start, i));
    out.push({ date: k, count: counts.get(k) ?? 0 });
  }
  return out;
}
