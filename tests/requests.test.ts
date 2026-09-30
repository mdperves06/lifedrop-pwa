import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { searchDonors } from "@/server/services/donors";
import { findMatches } from "@/server/services/matching";
import { actOnRequest, createBloodRequest, expireStaleRequests, requestDonors, respondToDonationRequest } from "@/server/services/requests";
import { updateUserAsAdmin, resolveReport } from "@/server/services/admin";
import { makeLocations, makeUser, resetDb } from "./fixtures";

type Locs = Awaited<ReturnType<typeof makeLocations>>;
let L: Locs;

const reqInput = (over: Partial<Parameters<typeof createBloodRequest>[1]> = {}) => ({
  bloodGroup: "O_POS" as const, units: 1, patientName: "Patient", hospitalName: `Hospital ${Math.random()}`, locationId: L.A.id,
  neededAt: new Date(Date.now() + 6 * 3_600_000), priority: "NORMAL" as const, contactPreference: "IN_APP" as const, ...over,
});

beforeEach(async () => {
  await resetDb();
  L = await makeLocations();
});

describe("donor search", () => {
  it("filters by location hierarchy, availability, emergency and blood group", async () => {
    await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, name: "Near Avail" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.B.id, availability: "TEMP_UNAVAILABLE", name: "Near Temp" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.C.id, emergencyAvailable: false, name: "Far District" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.D.id, name: "Other District" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, availability: "NOT_AVAILABLE", name: "Never" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, verified: false, name: "Unverified" });
    await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, lastDonationDaysAgo: 10, name: "Too Soon" });
    await makeUser({ bloodGroup: "O_NEG", locationId: L.A.id, name: "Neg Donor" });

    const byDistrict = await searchDonors({ bloodGroup: "O_POS", districtId: L.dist.id, availableNow: false }, { signedIn: true });
    const names = byDistrict.donors.map((d) => d.displayName).sort();
    expect(names).toEqual(["Far District", "Near Avail", "Near Temp", "Too Soon"].sort()); // NOT_AVAILABLE & unverified excluded, other district excluded

    const availNow = await searchDonors({ bloodGroup: "O_POS", districtId: L.dist.id, availableNow: true }, { signedIn: true });
    expect(availNow.donors.map((d) => d.displayName).sort()).toEqual(["Far District", "Near Avail"].sort());

    const emergency = await searchDonors({ bloodGroup: "O_POS", divisionId: L.div.id, availableNow: true, emergency: true }, { signedIn: true });
    expect(emergency.donors.map((d) => d.displayName).sort()).toEqual(["Near Avail", "Other District"].sort());

    const area = await searchDonors({ areaId: L.A.id, availableNow: true }, { signedIn: true });
    expect(area.donors.map((d) => d.displayName).sort()).toEqual(["Near Avail", "Neg Donor"].sort());

    const compat = await searchDonors({ bloodGroup: "O_POS", compatible: true, areaId: L.A.id, availableNow: true }, { signedIn: true });
    expect(compat.donors).toHaveLength(2); // O+ and O- can both give to O+
  });

  it("never exposes private fields and abbreviates names for anonymous viewers", async () => {
    await makeUser({ bloodGroup: "A_POS", locationId: L.A.id, name: "Rahim Ahmed" });
    const r = await searchDonors({ bloodGroup: "A_POS" }, { signedIn: false });
    expect(r.donors[0].displayName).toBe("Rahim A.");
    const keys = Object.keys(r.donors[0]);
    for (const k of ["phone", "email", "lat", "lng", "address", "passwordHash"]) expect(keys).not.toContain(k);
  });
});

describe("matching", () => {
  it("ranks compatible, available donors — same area and exact group first; respects radius", async () => {
    const near = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const neg = await makeUser({ bloodGroup: "O_NEG", locationId: L.A.id });
    const b = await makeUser({ bloodGroup: "O_POS", locationId: L.B.id });
    const far = await makeUser({ bloodGroup: "O_POS", locationId: L.C.id });
    await makeUser({ bloodGroup: "A_POS", locationId: L.A.id }); // incompatible
    const { candidates } = await findMatches({ bloodGroup: "O_POS", locationId: L.A.id, priority: "NORMAL" });
    expect(candidates.map((c) => c.userId)).toEqual([near.id, neg.id, b.id, far.id]);

    const radius = await findMatches({ bloodGroup: "O_POS", locationId: L.A.id, priority: "EMERGENCY", radiusKm: 5 });
    expect(radius.candidates.map((c) => c.userId).sort()).toEqual([near.id, neg.id, b.id].sort());
    expect(radius.expanded).toBe(false);
  });

  it("expands to the district when nobody is inside the radius", async () => {
    const far = await makeUser({ bloodGroup: "O_POS", locationId: L.C.id });
    const r = await findMatches({ bloodGroup: "O_POS", locationId: L.A.id, priority: "URGENT", radiusKm: 5 });
    expect(r.candidates.map((c) => c.userId)).toEqual([far.id]);
    expect(r.expanded).toBe(true);
  });
});

describe("blood request lifecycle", () => {
  it("creates a normal request (OPEN) without auto-notifying", async () => {
    const requester = await makeUser({});
    await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const { request, autoNotified } = await createBloodRequest(requester, reqInput());
    expect(request.status).toBe("OPEN");
    expect(autoNotified).toBe(0);
    const events = await db.requestStatusEvent.findMany({ where: { requestId: request.id } });
    expect(events).toHaveLength(1);
  });

  it("emergency request auto-notifies nearby emergency-available donors and creates notifications", async () => {
    const requester = await makeUser({});
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.B.id });
    await makeUser({ bloodGroup: "O_POS", locationId: L.B.id, emergencyAvailable: false });
    await makeUser({ bloodGroup: "O_POS", locationId: L.C.id }); // outside 5 km
    const { request, autoNotified } = await createBloodRequest(requester, reqInput({ priority: "EMERGENCY" }));
    expect(autoNotified).toBe(1);
    const r = await db.bloodRequest.findUnique({ where: { id: request.id } });
    expect(r?.status).toBe("DONOR_CONTACTED");
    const n = await db.notification.findMany({ where: { userId: d1.id } });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ type: "EMERGENCY_ALERT", bloodRequestId: request.id, readAt: null });
    expect(n[0].message).toContain("O+");
  });

  it("rejects duplicates, past dates and non-area locations", async () => {
    const requester = await makeUser({});
    const input = reqInput();
    await createBloodRequest(requester, input);
    await expect(createBloodRequest(requester, { ...input })).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
    await expect(createBloodRequest(requester, reqInput({ neededAt: new Date(Date.now() - 5 * 3_600_000) }))).rejects.toMatchObject({ status: 422 });
    await expect(createBloodRequest(requester, reqInput({ locationId: L.dist.id }))).rejects.toMatchObject({ status: 422 });
  });

  it("limits unverified requesters", async () => {
    const requester = await makeUser({ verified: false });
    await createBloodRequest(requester, reqInput());
    await createBloodRequest(requester, reqInput());
    await expect(createBloodRequest(requester, reqInput())).rejects.toMatchObject({ code: "UNVERIFIED_LIMIT" });
  });

  it("donor acceptance: reveals status, notifies requester, releases extra donors once units are covered", async () => {
    const requester = await makeUser({});
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const d2 = await makeUser({ bloodGroup: "O_NEG", locationId: L.A.id });
    const { request } = await createBloodRequest(requester, reqInput({ units: 1 }));
    const sent = await requestDonors(requester, request.id, [d1.id, d2.id]);
    expect(sent.sent).toBe(2);
    const [dr1, dr2] = await Promise.all([d1, d2].map((d) => db.donationRequest.findFirstOrThrow({ where: { donorId: d.id } })));

    await expect(respondToDonationRequest(d2.id, dr1.id, "ACCEPT")).rejects.toMatchObject({ status: 404 }); // not theirs
    await respondToDonationRequest(d1.id, dr1.id, "ACCEPT");
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("DONOR_ACCEPTED");
    expect((await db.donationRequest.findUnique({ where: { id: dr2.id } }))?.status).toBe("CANCELLED"); // enough donors
    expect(await db.notification.count({ where: { userId: requester.id, type: "REQUEST_ACCEPTED" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: d2.id, type: "REQUEST_CANCELLED" } })).toBe(1);
    await expect(respondToDonationRequest(d2.id, dr2.id, "ACCEPT")).rejects.toMatchObject({ code: "ALREADY_RESPONDED" });
  });

  it("all donors declining returns the request to MATCHING", async () => {
    const requester = await makeUser({});
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const { request } = await createBloodRequest(requester, reqInput());
    await requestDonors(requester, request.id, [d1.id]);
    const dr = await db.donationRequest.findFirstOrThrow({ where: { donorId: d1.id } });
    await respondToDonationRequest(d1.id, dr.id, "DECLINE");
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("MATCHING");
  });

  it("does not let requesters ask incompatible or on-cooldown donors", async () => {
    const requester = await makeUser({});
    const a = await makeUser({ bloodGroup: "A_POS", locationId: L.A.id });
    const soon = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id, lastDonationDaysAgo: 10 });
    const { request } = await createBloodRequest(requester, reqInput());
    await expect(requestDonors(requester, request.id, [a.id, soon.id])).rejects.toMatchObject({ code: "NO_VALID_DONORS" });
  });

  it("cancellation notifies contacted donors and blocks further responses", async () => {
    const requester = await makeUser({});
    const d1 = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const { request } = await createBloodRequest(requester, reqInput());
    await requestDonors(requester, request.id, [d1.id]);
    const other = await makeUser({});
    await expect(actOnRequest(other, request.id, "CANCEL")).rejects.toMatchObject({ status: 403 });
    await actOnRequest(requester, request.id, "CANCEL");
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("CANCELLED");
    expect(await db.notification.count({ where: { userId: d1.id, type: "REQUEST_CANCELLED" } })).toBe(1);
    const dr = await db.donationRequest.findFirstOrThrow({ where: { donorId: d1.id } });
    expect(dr.status).toBe("CANCELLED");
    await expect(respondToDonationRequest(d1.id, dr.id, "ACCEPT")).rejects.toMatchObject({ status: 409 });
    await expect(actOnRequest(requester, request.id, "FULFILL")).rejects.toMatchObject({ code: "BAD_TRANSITION" });
  });

  it("expires stale requests and allows reopening", async () => {
    const requester = await makeUser({});
    const { request } = await createBloodRequest(requester, reqInput({ neededAt: new Date(Date.now() - 30 * 60_000) }));
    await db.bloodRequest.update({ where: { id: request.id }, data: { neededAt: new Date(Date.now() - 48 * 3_600_000) } });
    expect(await expireStaleRequests()).toBe(1);
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("EXPIRED");
    await actOnRequest(requester, request.id, "REOPEN");
    expect((await db.bloodRequest.findUnique({ where: { id: request.id } }))?.status).toBe("OPEN");
  });
});

describe("admin permissions", () => {
  it("only admins can change roles; last admin and self-lockout are protected; sessions are revoked", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const donor = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    await expect(updateUserAsAdmin(donor, donor.id, { role: "ADMIN" })).rejects.toMatchObject({ status: 403 });
    await expect(updateUserAsAdmin(admin, admin.id, { role: "DONOR" })).rejects.toMatchObject({ code: "SELF_LOCKOUT" });
    const updated = await updateUserAsAdmin(admin, donor.id, { status: "SUSPENDED" });
    expect(updated.tokenVersion).toBe(1);
    expect((await db.donorProfile.findUnique({ where: { userId: donor.id } }))?.showInSearch).toBe(false);
    await expect(updateUserAsAdmin(admin, donor.id, { role: "CENTER_STAFF" })).rejects.toMatchObject({ status: 422 }); // needs a center
    expect(await db.auditLog.count({ where: { action: "admin.user_update" } })).toBe(1);
  });

  it("resolving a report with SUSPEND suspends the target and notifies the reporter", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const reporter = await makeUser({});
    const target = await makeUser({ bloodGroup: "O_POS", locationId: L.A.id });
    const report = await db.report.create({ data: { reporterId: reporter.id, targetUserId: target.id, reason: "FAKE_DONOR" } });
    await expect(resolveReport(reporter, report.id, { status: "RESOLVED", action: "SUSPEND" })).rejects.toMatchObject({ status: 403 });
    await resolveReport(admin, report.id, { status: "RESOLVED", action: "SUSPEND", adminNote: "confirmed" });
    expect((await db.user.findUnique({ where: { id: target.id } }))?.status).toBe("SUSPENDED");
    expect(await db.notification.count({ where: { userId: reporter.id, type: "REPORT_UPDATE" } })).toBe(1);
  });
});
