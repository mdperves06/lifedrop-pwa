import { db } from "@/server/db";
import type { BloodGroup, Role } from "@prisma/client";

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function resetDb() {
  await db.$transaction([
    db.notification.deleteMany(), db.donationRequest.deleteMany(), db.requestStatusEvent.deleteMany(), db.inventoryLog.deleteMany(),
    db.inventoryBatch.deleteMany(), db.donation.deleteMany(), db.appointment.deleteMany(), db.review.deleteMany(), db.report.deleteMany(),
    db.auditLog.deleteMany(), db.announcement.deleteMany(), db.campaign.deleteMany(), db.bloodRequest.deleteMany(), db.pushSubscription.deleteMany(),
    db.verificationToken.deleteMany(), db.donorProfile.deleteMany(), db.user.deleteMany(), db.hospital.deleteMany(), db.center.deleteMany(), db.appSetting.deleteMany(),
  ]);
  await db.location.updateMany({ data: { parentId: null } });
  await db.location.deleteMany();
}

/** Division → District(Dhaka) → areas A (0 km), B (~1.5 km), C (~12 km); plus another district D. */
export async function makeLocations() {
  const div = await db.location.create({ data: { name: `Div-${uid()}`, type: "DIVISION" } });
  const dist = await db.location.create({ data: { name: `Dhaka-${uid()}`, type: "DISTRICT", parentId: div.id } });
  const other = await db.location.create({ data: { name: `Other-${uid()}`, type: "DISTRICT", parentId: div.id } });
  const A = await db.location.create({ data: { name: `A-${uid()}`, type: "AREA", parentId: dist.id, lat: 23.7465, lng: 90.376 } });
  const B = await db.location.create({ data: { name: `B-${uid()}`, type: "AREA", parentId: dist.id, lat: 23.7389, lng: 90.3957 } });
  const C = await db.location.create({ data: { name: `C-${uid()}`, type: "AREA", parentId: dist.id, lat: 23.8583, lng: 90.2667 } });
  const D = await db.location.create({ data: { name: `D-${uid()}`, type: "AREA", parentId: other.id, lat: 24.8949, lng: 91.8687 } });
  return { div, dist, other, A, B, C, D };
}

export async function makeUser(opts: {
  role?: Role;
  locationId?: string;
  bloodGroup?: BloodGroup;
  verified?: boolean;
  availability?: "AVAILABLE" | "TEMP_UNAVAILABLE" | "NOT_AVAILABLE";
  emergencyAvailable?: boolean;
  lastDonationDaysAgo?: number | null;
  showInSearch?: boolean;
  centerId?: string;
  hospitalId?: string;
  name?: string;
}) {
  const id = uid();
  const verified = opts.verified ?? true;
  return db.user.create({
    data: {
      name: opts.name ?? `User ${id}`,
      email: `${id}@test.local`,
      phone: `+8801${String(700000000 + seq++)}`,
      passwordHash: "$2b$04$abcdefghijklmnopqrstuuFvZ2xLQ0f1s2kQzL8w9d8S7u9yW9J2K", // unused in service tests
      role: opts.role ?? "DONOR",
      referralCode: `R${id}`.slice(0, 20).toUpperCase(),
      locationId: opts.locationId,
      centerId: opts.centerId,
      hospitalId: opts.hospitalId,
      dateOfBirth: new Date("1994-01-01"),
      emailVerifiedAt: verified ? new Date() : null,
      donorProfile: opts.bloodGroup
        ? {
            create: {
              bloodGroup: opts.bloodGroup,
              weightKg: 65,
              healthDeclarationOk: true,
              availability: opts.availability ?? "AVAILABLE",
              emergencyAvailable: opts.emergencyAvailable ?? true,
              showInSearch: opts.showInSearch ?? true,
              lastDonationDate: opts.lastDonationDaysAgo == null ? null : new Date(Date.now() - opts.lastDonationDaysAgo * 86_400_000),
              locationId: opts.locationId,
            },
          }
        : undefined,
    },
    include: { donorProfile: true },
  });
}

export const actor = (u: { id: string; role: Role; emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; hospitalId?: string | null; centerId?: string | null }) => u;
