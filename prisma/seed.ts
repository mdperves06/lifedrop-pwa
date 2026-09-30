// DEMO / DEVELOPMENT DATA ONLY. All people, phone numbers and emails are fictional.
// Every demo user has isDemo=true and an @lifedrop.test email address.
//
// Demo sign-in accounts (password for all: Demo@1234):
//   admin@lifedrop.test      — Admin
//   staff@lifedrop.test      — Center staff (Dhanmondi center)
//   staff2@lifedrop.test     — Center staff (Uttara center)
//   hospital@lifedrop.test   — Hospital account
//   donor@lifedrop.test      — Donor (O+, Dhanmondi) with donation history
//   requester@lifedrop.test  — Regular user who has posted requests
import { PrismaClient, type BloodGroup } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LOCATIONS } from "./data/locations";

const db = new PrismaClient();
const DEMO_PASSWORD = "Demo@1234";
const DAY = 86_400_000;

// Deterministic PRNG so the dataset is reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const GROUP_WEIGHTS: [BloodGroup, number][] = [
  ["O_POS", 30], ["B_POS", 27], ["A_POS", 24], ["AB_POS", 8], ["O_NEG", 3], ["B_NEG", 3], ["A_NEG", 3], ["AB_NEG", 2],
];
function weightedGroup(): BloodGroup {
  let r = rand() * 100;
  for (const [g, w] of GROUP_WEIGHTS) if ((r -= w) <= 0) return g;
  return "O_POS";
}

const FIRST = ["Arif", "Nusrat", "Tanvir", "Farzana", "Rakib", "Sadia", "Imran", "Tasnim", "Shakil", "Mitu", "Hasan", "Sumaiya", "Rafi", "Jannat", "Nayeem", "Lamia", "Sabbir", "Anika", "Mahin", "Ritu", "Fahim", "Sharmin", "Zubair", "Priya", "Tareq", "Orin", "Kamrul", "Nabila", "Sajid", "Moumita"];
const LAST = ["Hossain", "Rahman", "Ahmed", "Islam", "Chowdhury", "Karim", "Akter", "Uddin", "Sarkar", "Das", "Khan", "Begum", "Talukder", "Mia", "Roy"];

let phoneSeq = 1000;
const demoPhone = () => `+88019${String(10000000 + phoneSeq++).slice(-8)}`;
let refSeq = 0;
const ref = () => `DEMO${String(++refSeq).padStart(4, "0")}`;

async function main() {
  console.log("Resetting database…");
  // Order matters for FK constraints.
  await db.$transaction([
    db.notification.deleteMany(), db.donationRequest.deleteMany(), db.requestStatusEvent.deleteMany(),
    db.inventoryLog.deleteMany(), db.inventoryBatch.deleteMany(), db.donation.deleteMany(), db.appointment.deleteMany(),
    db.review.deleteMany(), db.report.deleteMany(), db.auditLog.deleteMany(), db.announcement.deleteMany(), db.campaign.deleteMany(),
    db.bloodRequest.deleteMany(), db.pushSubscription.deleteMany(), db.verificationToken.deleteMany(), db.donorProfile.deleteMany(),
  ]);
  await db.user.updateMany({ data: { referredById: null } });
  await db.user.deleteMany();
  await db.hospital.deleteMany();
  await db.center.deleteMany();
  await db.location.updateMany({ data: { parentId: null } });
  await db.location.deleteMany();
  await db.appSetting.deleteMany();

  console.log("Locations…");
  const areaByName = new Map<string, { id: string; lat: number; lng: number }>();
  for (const div of LOCATIONS) {
    const d = await db.location.create({ data: { name: div.name, nameBn: div.nameBn, type: "DIVISION" } });
    for (const dist of div.districts) {
      const di = await db.location.create({ data: { name: dist.name, nameBn: dist.nameBn, type: "DISTRICT", parentId: d.id, lat: dist.areas[0][2], lng: dist.areas[0][3] } });
      for (const [name, nameBn, lat, lng] of dist.areas) {
        const a = await db.location.create({ data: { name, nameBn, type: "AREA", parentId: di.id, lat, lng } });
        areaByName.set(name, { id: a.id, lat, lng });
      }
    }
  }
  const area = (n: string) => areaByName.get(n)!;
  const dhakaAreas = LOCATIONS[0].districts[0].areas.map((a) => a[0]);

  console.log("Centers & hospitals…");
  const centerDefs = [
    { name: "LifeDrop Dhanmondi Donation Center (Demo)", area: "Dhanmondi", address: "Road 27 (demo address), Dhanmondi", open: "08:00", close: "18:00", cap: 4, needed: "O_NEG,A_NEG,B_NEG" },
    { name: "LifeDrop Uttara Donation Center (Demo)", area: "Uttara", address: "Sector 7 (demo address), Uttara", open: "08:00", close: "17:00", cap: 3, needed: "O_POS,AB_NEG" },
    { name: "LifeDrop Motijheel Blood Bank (Demo)", area: "Motijheel", address: "Commercial Area (demo address), Motijheel", open: "09:00", close: "18:00", cap: 5, needed: "B_NEG" },
    { name: "LifeDrop Mirpur Community Center (Demo)", area: "Mirpur", address: "Section 10 (demo address), Mirpur", open: "08:00", close: "13:00", cap: 3, needed: "O_NEG,O_POS" },
    { name: "LifeDrop Gulshan Donation Lounge (Demo)", area: "Gulshan", address: "Avenue 2 (demo address), Gulshan", open: "10:00", close: "18:00", cap: 2, needed: "" },
  ];
  const centers: { id: string; name: string }[] = [];
  for (const [i, c] of centerDefs.entries()) {
    const a = area(c.area);
    centers.push(
      await db.center.create({
        data: {
          name: c.name, address: c.address, phone: `+8802${String(9000000 + i * 1111).slice(-7)}`, email: `center${i + 1}@lifedrop.test`,
          locationId: a.id, lat: a.lat + 0.002, lng: a.lng - 0.002, openTime: c.open, closeTime: c.close, capacityPerSlot: c.cap,
          staffCount: int(4, 12), beds: int(3, 8), neededBloodGroups: c.needed, openDays: i === 3 ? "0,1,2,3,4,5,6" : "0,1,2,3,4,6",
          equipment: JSON.stringify(["Donation beds", "Blood pressure monitors", "Hemoglobin analyser", "Refrigerated storage", ...(i % 2 ? ["Apheresis machine"] : [])]),
          description: "Demo donation center for development and testing. Walk-ins welcome during opening hours.",
        },
      }),
    );
  }
  const hospitals: { id: string; name: string }[] = [];
  for (const [i, h] of [["Demo General Hospital", "Shahbagh"], ["Demo Children's Hospital", "Mohakhali"], ["Demo Heart Institute", "Shyamoli"], ["Demo City Medical College", "Panchlaish"]].entries()) {
    const a = area(h[1]);
    hospitals.push(await db.hospital.create({ data: { name: h[0], address: `${h[1]} (demo address)`, phone: `+8802${String(8000000 + i * 777).slice(-7)}`, locationId: a.id, lat: a.lat, lng: a.lng, verified: true } }));
  }

  console.log("Users…");
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = Date.now();
  const verified = new Date(now - 60 * DAY);
  const mkUser = (data: Record<string, unknown>) =>
    db.user.create({ data: { passwordHash: hash, isDemo: true, emailVerifiedAt: verified, phoneVerifiedAt: verified, referralCode: ref(), ...data } as never });

  const admin = await mkUser({ name: "Demo Admin", email: "admin@lifedrop.test", phone: demoPhone(), role: "ADMIN", locationId: area("Shahbagh").id });
  const staff = await mkUser({ name: "Demo Staff Dhanmondi", email: "staff@lifedrop.test", phone: demoPhone(), role: "CENTER_STAFF", centerId: centers[0].id, locationId: area("Dhanmondi").id });
  await mkUser({ name: "Demo Staff Uttara", email: "staff2@lifedrop.test", phone: demoPhone(), role: "CENTER_STAFF", centerId: centers[1].id, locationId: area("Uttara").id });
  const hospitalUser = await mkUser({ name: "Demo Hospital Desk", email: "hospital@lifedrop.test", phone: demoPhone(), role: "HOSPITAL", hospitalId: hospitals[0].id, locationId: area("Shahbagh").id });

  const mainDonor = await mkUser({
    name: "Demo Donor Rahim", email: "donor@lifedrop.test", phone: demoPhone(), locationId: area("Dhanmondi").id, gender: "MALE",
    dateOfBirth: new Date("1995-04-12"), organization: "Demo University",
    donorProfile: { create: { bloodGroup: "O_POS", weightKg: 68, availability: "AVAILABLE", emergencyAvailable: true, healthDeclarationOk: true, lastDonationDate: new Date(now - 120 * DAY), locationId: area("Dhanmondi").id } },
  });
  const requester = await mkUser({
    name: "Demo Requester Nadia", email: "requester@lifedrop.test", phone: demoPhone(), locationId: area("Mohammadpur").id, gender: "FEMALE", dateOfBirth: new Date("1990-09-01"),
    referredById: mainDonor.id,
    donorProfile: { create: { bloodGroup: "A_POS", weightKg: 55, availability: "TEMP_UNAVAILABLE", emergencyAvailable: false, healthDeclarationOk: true, locationId: area("Mohammadpur").id } },
  });

  const donors = [mainDonor];
  for (let i = 0; i < 60; i++) {
    const inDhaka = i < 48;
    const areaName = inDhaka ? pick(dhakaAreas) : pick(["Sylhet Sadar", "South Surma", "Panchlaish", "Agrabad", "Boalia", "Khulna Sadar", "Gazipur Sadar", "Tongi"]);
    const a = area(areaName);
    const avail = rand() < 0.75 ? "AVAILABLE" : rand() < 0.6 ? "TEMP_UNAVAILABLE" : "NOT_AVAILABLE";
    const lastDon = rand() < 0.35 ? null : new Date(now - int(20, 400) * DAY);
    const isVerified = rand() < 0.92;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    donors.push(
      await mkUser({
        name, email: `donor${i + 1}@lifedrop.test`, phone: demoPhone(), locationId: a.id,
        gender: pick(["MALE", "FEMALE", "MALE", "UNDISCLOSED"]), dateOfBirth: new Date(now - int(19, 58) * 365 * DAY),
        emailVerifiedAt: isVerified ? verified : null, phoneVerifiedAt: isVerified && rand() < 0.7 ? verified : null,
        lastActiveAt: new Date(now - int(0, 90) * DAY), referredById: i % 9 === 0 ? mainDonor.id : undefined,
        donorProfile: {
          create: {
            bloodGroup: weightedGroup(), weightKg: int(50, 90), availability: avail, emergencyAvailable: rand() < 0.6, healthDeclarationOk: true,
            lastDonationDate: lastDon, locationId: a.id, sharePhoneAfterAccept: rand() < 0.85, shareEmailAfterAccept: rand() < 0.3,
          },
        },
      }),
    );
  }
  // Guarantee a few rare-group, emergency-ready donors near the main hospital for demos.
  for (const [g, an] of [["O_NEG", "Shahbagh"], ["O_NEG", "Dhanmondi"], ["AB_NEG", "Farmgate"], ["B_NEG", "Tejgaon"]] as const) {
    donors.push(
      await mkUser({
        name: `${pick(FIRST)} ${pick(LAST)}`, email: `rare-${g.toLowerCase()}-${an.toLowerCase()}@lifedrop.test`, phone: demoPhone(), locationId: area(an).id,
        dateOfBirth: new Date(now - 30 * 365 * DAY), lastActiveAt: new Date(now - 2 * DAY),
        donorProfile: { create: { bloodGroup: g, weightKg: 70, availability: "AVAILABLE", emergencyAvailable: true, healthDeclarationOk: true, locationId: area(an).id } },
      }),
    );
  }

  console.log("Donations, inventory & appointments…");
  const profiles = await db.donorProfile.findMany();
  const groupOf = new Map(profiles.map((p) => [p.userId, p.bloodGroup]));
  let certSeq = 0;
  // Historical donations over the last 12 months (drives analytics + certificates).
  for (let i = 0; i < 260; i++) {
    const donorIdx = i < 7 ? 0 : 1 + Math.floor(rand() * (donors.length - 1));
    const donor = donors[donorIdx];
    // Half the donors only have older donations so they're past the donation interval (matchable in demos).
    const daysAgo = i < 7 ? 120 + i * 100 : donorIdx % 2 === 0 ? int(100, 540) : int(0, 360);
    const at = new Date(now - daysAgo * DAY - int(8, 16) * 3_600_000);
    const center = pick(centers);
    const bg = groupOf.get(donor.id)!;
    const d = await db.donation.create({
      data: { donorId: donor.id, centerId: center.id, bloodGroup: bg, volumeMl: pick([350, 450, 450]), donatedAt: at, recordedById: staff.id, certificateNo: `LD-DEMO-${String(++certSeq).padStart(5, "0")}` },
    });
    // Recent donations are still on the shelf; older ones were used or expired.
    const expiresAt = new Date(at.getTime() + 42 * DAY);
    const status = expiresAt.getTime() > now ? (rand() < 0.8 ? "AVAILABLE" : "USED") : rand() < 0.85 ? "USED" : "EXPIRED";
    const b = await db.inventoryBatch.create({ data: { centerId: center.id, bloodGroup: bg, units: 1, collectedAt: at, expiresAt, status, donationId: d.id } });
    await db.inventoryLog.create({ data: { centerId: center.id, bloodGroup: bg, change: 1, reason: "DONATION", batchId: b.id, userId: staff.id, createdAt: at } });
    if (status !== "AVAILABLE") {
      const when = new Date(Math.min(now - DAY, at.getTime() + int(2, 40) * DAY));
      await db.inventoryLog.create({ data: { centerId: center.id, bloodGroup: bg, change: -1, reason: status === "USED" ? "ISSUE" : "EXPIRED", batchId: b.id, userId: staff.id, createdAt: when } });
    }
  }
  // Bulk stock from partner transfers so levels look realistic, deliberately low for O- and AB-.
  const bulk: [BloodGroup, number][] = [["O_POS", 22], ["A_POS", 18], ["B_POS", 20], ["AB_POS", 9], ["A_NEG", 4], ["B_NEG", 3], ["O_NEG", 1], ["AB_NEG", 0]];
  for (const [g, n] of bulk) {
    if (!n) continue;
    const center = pick(centers);
    const at = new Date(now - int(3, 20) * DAY);
    const b = await db.inventoryBatch.create({ data: { centerId: center.id, bloodGroup: g, units: n, collectedAt: at, expiresAt: new Date(at.getTime() + 42 * DAY) } });
    await db.inventoryLog.create({ data: { centerId: center.id, bloodGroup: g, change: n, reason: "ADJUSTMENT", batchId: b.id, userId: admin.id, note: "Demo partner transfer", createdAt: at } });
  }
  // One batch that expires in 3 days (shows "expiring soon").
  await db.inventoryBatch.create({ data: { centerId: centers[0].id, bloodGroup: "A_POS", units: 3, collectedAt: new Date(now - 39 * DAY), expiresAt: new Date(now + 3 * DAY) } });

  // Keep donor profiles in sync with their latest recorded donation.
  const latest = await db.donation.groupBy({ by: ["donorId"], _max: { donatedAt: true } });
  for (const l of latest) {
    if (l._max.donatedAt) await db.donorProfile.updateMany({ where: { userId: l.donorId }, data: { lastDonationDate: l._max.donatedAt } });
  }
  // The main demo donor must be eligible today for the booking demo.
  await db.donorProfile.update({ where: { userId: mainDonor.id }, data: { lastDonationDate: new Date(now - 120 * DAY), nextAvailableDate: null } });

  // Upcoming appointments.
  const tomorrow9 = new Date(now + DAY);
  const tzShift = 6 * 3_600_000; // Asia/Dhaka
  const localMidnight = (t: number) => { const d = new Date(t + tzShift); d.setUTCHours(0, 0, 0, 0); return d.getTime() - tzShift; };
  const slotAt = (daysAhead: number, hour: number) => new Date(localMidnight(now + daysAhead * DAY) + hour * 3_600_000);
  for (let i = 0; i < 18; i++) {
    const donor = donors[1 + i];
    await db.appointment.create({ data: { donorId: donor.id, centerId: centers[i % 3].id, startsAt: slotAt(int(1, 10), pick([9, 10, 11, 14, 15, 16])), status: "BOOKED" } }).catch(() => {});
  }
  // A couple of today's appointments for the staff portal.
  for (let i = 0; i < 4; i++) {
    await db.appointment.create({ data: { donorId: donors[30 + i].id, centerId: centers[0].id, startsAt: slotAt(0, [9, 11, 15, 16][i]), status: i === 0 ? "CHECKED_IN" : "BOOKED" } });
  }
  void tomorrow9;
  // Completed appointments for reviews.
  const reviewTexts = ["Friendly staff and quick process.", "Clean and well organised.", "Had to wait a bit, but great care.", "Very professional team!", "Comfortable beds and snacks after donating."];
  for (const [i, c] of centers.entries()) {
    for (let k = 0; k < 3; k++) {
      const donor = donors[5 + i * 3 + k];
      await db.appointment.create({ data: { donorId: donor.id, centerId: c.id, startsAt: new Date(now - int(20, 90) * DAY), status: "COMPLETED" } });
      await db.review.create({ data: { centerId: c.id, userId: donor.id, rating: int(3, 5), comment: pick(reviewTexts) } });
    }
  }

  console.log("Blood requests…");
  const mkReq = async (o: { by: string; bg: BloodGroup; units: number; hosp: number; areaName: string; pri: "NORMAL" | "URGENT" | "EMERGENCY"; status: string; hoursAhead: number; patient: string; notes?: string; hospitalId?: string }) => {
    const r = await db.bloodRequest.create({
      data: {
        requesterId: o.by, bloodGroup: o.bg, units: o.units, patientName: o.patient, hospitalName: hospitals[o.hosp].name, hospitalId: o.hospitalId ?? null,
        locationId: area(o.areaName).id, neededAt: new Date(now + o.hoursAhead * 3_600_000), priority: o.pri, status: o.status as never,
        notes: o.notes ?? "Demo request — not a real patient.", contactPreference: "BOTH", contactPhone: "+8801900000000",
        createdAt: new Date(now - int(1, 20) * 3_600_000), closedAt: ["FULFILLED", "CLOSED", "CANCELLED", "EXPIRED"].includes(o.status) ? new Date(now - DAY) : null,
      },
    });
    await db.requestStatusEvent.create({ data: { requestId: r.id, toStatus: "OPEN", actorId: o.by, note: "Request created", createdAt: r.createdAt } });
    if (o.status !== "OPEN") await db.requestStatusEvent.create({ data: { requestId: r.id, fromStatus: "OPEN", toStatus: o.status as never, actorId: o.by } });
    return r;
  };
  const eligibleOf = (g: BloodGroup) => donors.filter((d) => groupOf.get(d.id) === g && d.id !== mainDonor.id).slice(0, 3);

  const r1 = await mkReq({ by: hospitalUser.id, hospitalId: hospitals[0].id, bg: "O_NEG", units: 2, hosp: 0, areaName: "Shahbagh", pri: "EMERGENCY", status: "DONOR_CONTACTED", hoursAhead: 4, patient: "Demo Patient A", notes: "Road accident — surgery scheduled (demo)." });
  const r2 = await mkReq({ by: requester.id, bg: "O_POS", units: 1, hosp: 1, areaName: "Mohakhali", pri: "URGENT", status: "DONOR_ACCEPTED", hoursAhead: 20, patient: "Demo Patient B" });
  const r3 = await mkReq({ by: requester.id, bg: "B_POS", units: 2, hosp: 2, areaName: "Shyamoli", pri: "NORMAL", status: "OPEN", hoursAhead: 72, patient: "Demo Patient C" });
  await mkReq({ by: requester.id, bg: "A_POS", units: 1, hosp: 0, areaName: "Shahbagh", pri: "NORMAL", status: "FULFILLED", hoursAhead: -30, patient: "Demo Patient D" });
  await mkReq({ by: hospitalUser.id, hospitalId: hospitals[0].id, bg: "AB_POS", units: 1, hosp: 0, areaName: "Shahbagh", pri: "URGENT", status: "CANCELLED", hoursAhead: -10, patient: "Demo Patient E" });
  await mkReq({ by: donors[10].id, bg: "B_NEG", units: 1, hosp: 3, areaName: "Panchlaish", pri: "EMERGENCY", status: "MATCHING", hoursAhead: 6, patient: "Demo Patient F" });

  // Emergency request → main demo donor + O- donors were contacted.
  const oNeg = donors.filter((d) => groupOf.get(d.id) === "O_NEG").slice(0, 3);
  for (const d of [mainDonor, ...oNeg]) {
    const dr = await db.donationRequest.create({ data: { bloodRequestId: r1.id, donorId: d.id, source: "AUTO_MATCH", distanceKm: Math.round(rand() * 40) / 10 } });
    await db.notification.create({
      data: { userId: d.id, type: "EMERGENCY_ALERT", title: "Emergency blood request", message: `O- needed at ${hospitals[0].name}, Shahbagh. Respond to this request.`, link: `/incoming/${dr.id}`, bloodRequestId: r1.id, donationRequestId: dr.id },
    });
  }
  // Urgent request accepted by one donor.
  const oPos = eligibleOf("O_POS");
  if (oPos[0]) {
    await db.donationRequest.create({ data: { bloodRequestId: r2.id, donorId: oPos[0].id, status: "ACCEPTED", respondedAt: new Date(now - 2 * 3_600_000) } });
    await db.notification.create({ data: { userId: requester.id, type: "REQUEST_ACCEPTED", title: "A donor accepted your request", message: `${oPos[0].name} accepted your O+ request (1/1 units).`, link: `/requests/${r2.id}`, bloodRequestId: r2.id } });
  }
  if (oPos[1]) await db.donationRequest.create({ data: { bloodRequestId: r2.id, donorId: oPos[1].id, status: "DECLINED", respondedAt: new Date(now - 3 * 3_600_000) } });
  void r3;

  console.log("Campaigns, reports, notifications…");
  await db.campaign.create({ data: { title: "University Blood Drive (Demo)", description: "Annual on-campus blood donation camp. Free health check-up for every donor.", venue: "Demo University TSC, Shahbagh", locationId: area("Shahbagh").id, centerId: centers[0].id, startsAt: new Date(now + 6 * DAY), endsAt: new Date(now + 6 * DAY + 8 * 3_600_000), targetDonors: 150, createdById: admin.id } });
  await db.campaign.create({ data: { title: "Corporate Donation Day (Demo)", description: "Blood donation drive for office workers in Gulshan and Banani.", venue: "Demo Tower Lobby, Gulshan", locationId: area("Gulshan").id, centerId: centers[4].id, startsAt: new Date(now + 14 * DAY), endsAt: new Date(now + 14 * DAY + 6 * 3_600_000), targetDonors: 80, createdById: admin.id } });
  await db.campaign.create({ data: { title: "Winter Thalassemia Appeal (Demo)", description: "Drive supporting thalassemia patients who need regular transfusions.", venue: "Demo Community Hall, Mirpur", locationId: area("Mirpur").id, centerId: centers[3].id, startsAt: new Date(now - 40 * DAY), endsAt: new Date(now - 40 * DAY + 8 * 3_600_000), targetDonors: 100, status: "COMPLETED", createdById: admin.id } });

  await db.report.create({ data: { reporterId: requester.id, targetUserId: donors[20].id, reason: "FAKE_DONOR", details: "Demo report: donor accepted then became unreachable.", status: "PENDING" } });
  await db.report.create({ data: { reporterId: mainDonor.id, bloodRequestId: r3.id, reason: "INCORRECT_INFO", details: "Demo report: hospital name looks wrong.", status: "REVIEWING" } });

  await db.notification.create({ data: { userId: mainDonor.id, type: "ANNOUNCEMENT", title: "Welcome to LifeDrop (demo)", message: "Thanks for being a donor. Keep your availability up to date so requesters can find you.", link: "/dashboard", readAt: new Date(now - DAY) } });
  await db.notification.create({ data: { userId: admin.id, type: "LOW_STOCK", title: "Critical stock: AB-", message: "City-wide AB- stock is 0 unit(s). Consider a donor drive or targeted appeal.", link: "/admin/inventory" } });
  await db.notification.create({ data: { userId: admin.id, type: "LOW_STOCK", title: "Critical stock: O-", message: "City-wide O- stock is low. Consider a targeted appeal.", link: "/admin/inventory" } });

  await db.auditLog.create({ data: { actorId: admin.id, action: "seed.run", entityType: "System", meta: JSON.stringify({ note: "Demo data loaded" }) } });

  console.log(`\nSeed complete. ${donors.length} demo donors, ${centers.length} centers.`);
  console.log(`Demo accounts use password: ${DEMO_PASSWORD} (see prisma/seed.ts header).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
