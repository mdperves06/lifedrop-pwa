import "server-only";
import { db } from "@/server/db";
import { ACTIVE_STATUSES } from "@/lib/lifecycle";
import { BLOOD_GROUPS } from "@/lib/blood";
import { ageFromDob } from "@/lib/eligibility";
import { localParts, fromLocal } from "@/lib/time";
import { eligibleDonorWhere } from "@/server/services/matching";
import { getSettings } from "@/server/settings";

export const LIVES_PER_DONATION = 3;

export async function publicImpact() {
  const [donors, donations, fulfilled, centers] = await Promise.all([
    db.donorProfile.count({ where: { user: { status: "ACTIVE", deletedAt: null } } }),
    db.donation.count(),
    db.bloodRequest.count({ where: { status: { in: ["FULFILLED", "CLOSED"] } } }),
    db.center.count({ where: { isActive: true } }),
  ]);
  return { donors, donations, livesSaved: donations * LIVES_PER_DONATION, fulfilled, centers };
}

export async function adminMetrics() {
  const settings = await getSettings();
  const now = new Date();
  const p = localParts(now);
  const monthStart = fromLocal(p.y, p.m, 1);
  const [users, donors, activeDonors, activeRequests, emergencyRequests, fulfilledRequests, pendingReports, donationsThisMonth, volume, upcomingAppointments] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.donorProfile.count({ where: { user: { deletedAt: null } } }),
      db.donorProfile.count({ where: eligibleDonorWhere(settings.donationIntervalDays, now) }),
      db.bloodRequest.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      db.bloodRequest.count({ where: { status: { in: ACTIVE_STATUSES }, priority: "EMERGENCY" } }),
      db.bloodRequest.count({ where: { status: { in: ["FULFILLED", "CLOSED"] } } }),
      db.report.count({ where: { status: { in: ["PENDING", "REVIEWING"] } } }),
      db.donation.count({ where: { donatedAt: { gte: monthStart } } }),
      db.donation.aggregate({ where: { donatedAt: { gte: monthStart } }, _sum: { volumeMl: true } }),
      db.appointment.count({ where: { status: "BOOKED", startsAt: { gte: now } } }),
    ]);
  return {
    users,
    donors,
    activeDonors,
    activeRequests,
    emergencyRequests,
    fulfilledRequests,
    pendingReports,
    donationsThisMonth,
    litersThisMonth: Math.round(((volume._sum.volumeMl ?? 0) / 1000) * 10) / 10,
    upcomingAppointments,
  };
}

export async function analytics() {
  const now = new Date();
  const p = localParts(now);
  const months: { key: string; start: Date; end: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const y = p.m - i <= 0 ? p.y - 1 : p.y;
    const m = ((p.m - i - 1 + 12) % 12) + 1;
    const start = fromLocal(y, m, 1);
    const end = m === 12 ? fromLocal(y + 1, 1, 1) : fromLocal(y, m + 1, 1);
    months.push({ key: `${y}-${String(m).padStart(2, "0")}`, start, end });
  }
  const since = months[0].start;
  const [donations, requests, profiles, byGender] = await Promise.all([
    db.donation.findMany({ where: { donatedAt: { gte: since } }, select: { donatedAt: true } }),
    db.bloodRequest.findMany({ where: { createdAt: { gte: since }, status: { not: "DRAFT" } }, select: { bloodGroup: true, createdAt: true, priority: true, status: true } }),
    db.donorProfile.findMany({ where: { user: { deletedAt: null } }, select: { bloodGroup: true, user: { select: { dateOfBirth: true } } } }),
    db.user.groupBy({ by: ["gender"], where: { deletedAt: null, donorProfile: { isNot: null } }, _count: { _all: true } }),
  ]);

  const trend = months.map((m) => ({
    month: m.key,
    donations: donations.filter((d) => d.donatedAt >= m.start && d.donatedAt < m.end).length,
    requests: requests.filter((r) => r.createdAt >= m.start && r.createdAt < m.end).length,
  }));
  const donorsByGroup = BLOOD_GROUPS.map((g) => ({ group: g, count: profiles.filter((x) => x.bloodGroup === g).length }));
  const demandByGroup = BLOOD_GROUPS.map((g) => ({
    group: g,
    count: requests.filter((r) => r.bloodGroup === g).length,
    emergency: requests.filter((r) => r.bloodGroup === g && r.priority === "EMERGENCY").length,
  }));
  const buckets = ["18-25", "26-35", "36-45", "46-60", "Other/unknown"];
  const ages = profiles.map((x) => ageFromDob(x.user.dateOfBirth, now));
  const ageBuckets = buckets.map((b) => ({
    bucket: b,
    count: ages.filter((a) => {
      if (a == null) return b === "Other/unknown";
      if (b === "18-25") return a >= 18 && a <= 25;
      if (b === "26-35") return a >= 26 && a <= 35;
      if (b === "36-45") return a >= 36 && a <= 45;
      if (b === "46-60") return a >= 46 && a <= 60;
      return a < 18 || a > 60;
    }).length,
  }));
  const fulfilled = requests.filter((r) => r.status === "FULFILLED" || r.status === "CLOSED").length;
  return {
    trend,
    donorsByGroup,
    demandByGroup,
    ageBuckets,
    gender: byGender.map((g) => ({ gender: g.gender, count: g._count._all })),
    fulfilmentRate: requests.length ? Math.round((fulfilled / requests.length) * 100) : 0,
  };
}
