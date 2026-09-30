import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { bookAppointment, cancelAppointment, sendAppointmentReminders } from "@/server/services/appointments";
import { adjustInventory, expireBatches, recordDonation, stockByGroup } from "@/server/services/inventory";
import { slotAvailability } from "@/server/services/centers";
import { deleteAccount } from "@/server/services/auth";
import { createBloodRequest } from "@/server/services/requests";
import { makeLocations, makeUser, resetDb } from "./fixtures";

type Locs = Awaited<ReturnType<typeof makeLocations>>;
let L: Locs;
let centerId: string;

beforeEach(async () => {
  await resetDb();
  L = await makeLocations();
  const c = await db.center.create({
    data: { name: "Test Center", address: "addr", phone: "+8802000000", locationId: L.A.id, lat: 23.74, lng: 90.37, openTime: "08:00", closeTime: "18:00", openDays: "0,1,2,3,4,5,6", capacityPerSlot: 1 },
  });
  centerId = c.id;
});

async function firstSlot() {
  const days = await slotAvailability(centerId, undefined, 7);
  return days.flatMap((d) => d.slots).find((s) => !s.past && s.remaining > 0)!;
}

describe("appointments", () => {
  it("books a valid slot, enforces capacity and one active appointment", async () => {
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const d2 = await makeUser({ bloodGroup: "A_POS", locationId: L.A.id });
    const slot = await firstSlot();
    const a = await bookAppointment(d1.id, { centerId, startsAt: new Date(slot.startsAt) });
    expect(a.status).toBe("BOOKED");
    await expect(bookAppointment(d2.id, { centerId, startsAt: new Date(slot.startsAt) })).rejects.toMatchObject({ code: "SLOT_FULL" });
    await expect(bookAppointment(d1.id, { centerId, startsAt: new Date(slot.startsAt) })).rejects.toMatchObject({ code: "HAS_APPOINTMENT" });
    expect(await db.notification.count({ where: { userId: d1.id, type: "APPOINTMENT_UPDATE" } })).toBe(1);
  });

  it("runs the eligibility check before booking", async () => {
    const recent = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, lastDonationDaysAgo: 5 });
    const slot = await firstSlot();
    await expect(bookAppointment(recent.id, { centerId, startsAt: new Date(slot.startsAt) })).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    const noProfile = await makeUser({});
    await expect(bookAppointment(noProfile.id, { centerId, startsAt: new Date(slot.startsAt) })).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("rejects times outside slots and lets only owners/staff cancel", async () => {
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const slot = await firstSlot();
    await expect(bookAppointment(d1.id, { centerId, startsAt: new Date(Date.parse(slot.startsAt) + 20 * 60_000) })).rejects.toMatchObject({ code: "BAD_SLOT" });
    const a = await bookAppointment(d1.id, { centerId, startsAt: new Date(slot.startsAt) });
    const stranger = await makeUser({});
    await expect(cancelAppointment({ id: stranger.id, role: "DONOR" }, a.id)).rejects.toMatchObject({ status: 403 });
    await cancelAppointment({ id: d1.id, role: "DONOR" }, a.id);
    expect((await db.appointment.findUnique({ where: { id: a.id } }))?.status).toBe("CANCELLED");
  });

  it("sends 24h and 1h reminders exactly once", async () => {
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const a = await db.appointment.create({ data: { donorId: d1.id, centerId, startsAt: new Date(Date.now() + 20 * 3_600_000) } });
    expect((await sendAppointmentReminders()).reminders24).toBe(1);
    expect((await sendAppointmentReminders()).reminders24).toBe(0);
    await db.appointment.update({ where: { id: a.id }, data: { startsAt: new Date(Date.now() + 30 * 60_000) } });
    expect((await sendAppointmentReminders()).reminders1).toBe(1);
    expect(await db.notification.count({ where: { userId: d1.id, type: "APPOINTMENT_REMINDER" } })).toBe(2);
  });
});

describe("inventory & donations", () => {
  it("adds, issues FEFO, prevents over-issue and scopes staff to their center", async () => {
    const staff = await makeUser({ role: "CENTER_STAFF", centerId });
    const other = await db.center.create({ data: { name: "Other", address: "a", phone: "+8802000001", locationId: L.B.id, lat: 1, lng: 1 } });
    await adjustInventory(staff, { centerId, bloodGroup: "A_POS", units: 5, mode: "ADD", collectedAt: new Date(Date.now() - 20 * 86_400_000) });
    await adjustInventory(staff, { centerId, bloodGroup: "A_POS", units: 5, mode: "ADD" });
    await adjustInventory(staff, { centerId, bloodGroup: "A_POS", units: 3, mode: "ISSUE" });
    const batches = await db.inventoryBatch.findMany({ where: { centerId, status: "AVAILABLE" }, orderBy: { expiresAt: "asc" } });
    expect(batches.map((b) => b.units)).toEqual([2, 5]); // oldest batch consumed first
    await expect(adjustInventory(staff, { centerId, bloodGroup: "A_POS", units: 50, mode: "ISSUE" })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(adjustInventory(staff, { centerId: other.id, bloodGroup: "A_POS", units: 1, mode: "ADD" })).rejects.toMatchObject({ status: 403 });
    const donor = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    await expect(adjustInventory(donor, { centerId, bloodGroup: "A_POS", units: 1, mode: "ADD" })).rejects.toMatchObject({ status: 403 });
    expect((await stockByGroup(centerId)).find((s) => s.bloodGroup === "A_POS")?.units).toBe(7);
  });

  it("expires batches and alerts admins when stock becomes critical", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await db.inventoryBatch.create({ data: { centerId, bloodGroup: "O_NEG", units: 6, collectedAt: new Date(Date.now() - 50 * 86_400_000), expiresAt: new Date(Date.now() - 86_400_000) } });
    expect(await expireBatches()).toBe(6);
    expect(await db.inventoryBatch.count({ where: { status: "EXPIRED" } })).toBe(1);
    expect(await db.inventoryLog.count({ where: { reason: "EXPIRED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: admin.id, type: "LOW_STOCK" } })).toBeGreaterThanOrEqual(1);
  });

  it("records a donation: completes the appointment, adds stock, updates donor eligibility, issues certificate", async () => {
    const staff = await makeUser({ role: "CENTER_STAFF", centerId });
    const donor = await makeUser({ bloodGroup: "B_POS", locationId: L.A.id });
    const appt = await db.appointment.create({ data: { donorId: donor.id, centerId, startsAt: new Date(), status: "CHECKED_IN" } });
    const d = await recordDonation(staff, { appointmentId: appt.id, donorId: donor.id, centerId, bloodGroup: "B_POS", volumeMl: 450 });
    expect(d.certificateNo).toMatch(/^LD-\d{4}-[0-9A-F]{8}$/);
    expect((await db.appointment.findUnique({ where: { id: appt.id } }))?.status).toBe("COMPLETED");
    expect((await stockByGroup(centerId)).find((s) => s.bloodGroup === "B_POS")?.units).toBe(1);
    const dp = await db.donorProfile.findUnique({ where: { userId: donor.id } });
    expect(dp?.lastDonationDate).not.toBeNull();
    await expect(recordDonation(staff, { appointmentId: appt.id, donorId: donor.id, centerId, bloodGroup: "B_POS", volumeMl: 450 })).rejects.toMatchObject({ status: 409 });
  });
});

describe("account deletion", () => {
  it("anonymises the user and withdraws them from active requests", async () => {
    const user = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, name: "To Delete" });
    const { request } = await createBloodRequest(user, {
      bloodGroup: "A_POS", units: 1, patientName: "Someone", hospitalName: "H", locationId: L.A.id, neededAt: new Date(Date.now() + 3_600_000), priority: "NORMAL", contactPreference: "IN_APP",
    });
    await deleteAccount(user.id);
    const u = await db.user.findUnique({ where: { id: user.id } });
    expect(u).toMatchObject({ status: "REMOVED", name: "Deleted user", avatarPath: null });
    expect(u!.email).not.toContain("test.local");
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("CANCELLED");
    expect((await db.donorProfile.findUnique({ where: { userId: user.id } }))?.showInSearch).toBe(false);
  });
});
