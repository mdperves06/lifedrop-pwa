import "server-only";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { ACTIVE_STATUSES } from "@/lib/lifecycle";
import { ancestry, locationMap } from "@/server/services/locations";
import { acceptedDonorContacts, canManageRequest } from "@/server/services/requests";

/** Public board: active requests without patient names or contact details. */
export async function publicRequestBoard(limit = 30, onlyEmergency = false) {
  const rows = await db.bloodRequest.findMany({
    where: { status: { in: ACTIVE_STATUSES }, ...(onlyEmergency ? { priority: "EMERGENCY" } : {}) },
    orderBy: [{ priority: "desc" }, { neededAt: "asc" }],
    take: limit,
    select: { id: true, bloodGroup: true, units: true, unitsFulfilled: true, hospitalName: true, locationId: true, neededAt: true, priority: true, status: true, createdAt: true },
  });
  const locs = await locationMap();
  return rows.map((r) => {
    const a = locs.get(r.locationId);
    const d = a?.parentId ? locs.get(a.parentId) : undefined;
    return { ...r, area: [a?.name, d?.name].filter(Boolean).join(", "), areaBn: [a?.nameBn, d?.nameBn].filter(Boolean).join(", ") };
  });
}

type Viewer = { id: string; role: Role; hospitalId?: string | null } | null;

/**
 * Role-aware request detail:
 *  - manager (requester / hospital / admin): everything incl. responses + accepted donor contacts
 *  - donor who was asked: hospital + requester contact after accepting
 *  - everyone else: public-safe summary
 */
export async function requestDetail(id: string, viewer: Viewer) {
  const r = await db.bloodRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true } },
      hospital: { select: { name: true, phone: true, address: true } },
      statusEvents: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } },
      donationRequests: {
        orderBy: { createdAt: "desc" },
        select: { id: true, donorId: true, status: true, source: true, respondedAt: true, createdAt: true, distanceKm: true, donor: { select: { name: true, donorProfile: { select: { bloodGroup: true } } } } },
      },
    },
  });
  if (!r) return null;
  const chain = await ancestry(r.locationId);
  const area = chain.slice(0, 2).map((l) => l.name).join(", ");
  const areaBn = chain.slice(0, 2).map((l) => l.nameBn ?? l.name).join(", ");
  const manager = !!viewer && (canManageRequest(viewer, r) || viewer.role === "CENTER_STAFF");
  const myInvite = viewer ? r.donationRequests.find((d) => d.donorId === viewer.id) : undefined;
  const revealToDonor = myInvite && (myInvite.status === "ACCEPTED" || myInvite.status === "DONATED");

  const base = {
    id: r.id,
    bloodGroup: r.bloodGroup,
    units: r.units,
    unitsFulfilled: r.unitsFulfilled,
    hospitalName: r.hospitalName,
    area,
    areaBn,
    neededAt: r.neededAt,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt,
    matchRadiusKm: r.matchRadiusKm,
    requesterVerified: !!(r.requester.emailVerifiedAt || r.requester.phoneVerifiedAt),
    timeline: r.statusEvents,
    counts: {
      contacted: r.donationRequests.length,
      accepted: r.donationRequests.filter((d) => d.status === "ACCEPTED" || d.status === "DONATED").length,
      declined: r.donationRequests.filter((d) => d.status === "DECLINED").length,
      pending: r.donationRequests.filter((d) => d.status === "PENDING").length,
    },
  };

  return {
    ...base,
    isManager: manager && !!viewer && canManageRequest(viewer, r),
    isStaff: viewer?.role === "CENTER_STAFF" || viewer?.role === "ADMIN",
    myInvite: myInvite ? { id: myInvite.id, status: myInvite.status, distanceKm: myInvite.distanceKm } : null,
    private:
      manager || revealToDonor
        ? {
            patientName: r.patientName,
            hospitalAddress: r.hospitalAddress ?? r.hospital?.address ?? null,
            hospitalPhone: r.hospital?.phone ?? null,
            notes: r.notes,
            contactPreference: r.contactPreference,
            requesterName: r.requester.name,
            // Requester phone is shared with donors only once they accept, and only if the requester opted into phone contact.
            contactPhone: r.contactPreference !== "IN_APP" ? r.contactPhone ?? r.requester.phone : null,
          }
        : null,
    responses: manager
      ? r.donationRequests.map((d) => ({ id: d.id, donorName: d.donor.name, bloodGroup: d.donor.donorProfile?.bloodGroup ?? null, status: d.status, source: d.source, respondedAt: d.respondedAt, createdAt: d.createdAt, distanceKm: d.distanceKm }))
      : [],
    acceptedContacts: manager ? await acceptedDonorContacts(r.id) : [],
  };
}

export type RequestDetail = NonNullable<Awaited<ReturnType<typeof requestDetail>>>;
