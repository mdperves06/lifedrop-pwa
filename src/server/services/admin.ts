import "server-only";
import type { Audience, Role, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";

type Admin = { id: string; role: Role };

function assertAdmin(a: Admin) {
  if (a.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Admins only.");
}

export async function updateUserAsAdmin(
  admin: Admin,
  userId: string,
  input: { role?: Role; status?: UserStatus; centerId?: string | null; hospitalId?: string | null; verifyEmail?: boolean; reason?: string },
  ip?: string,
) {
  assertAdmin(admin);
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) throw new ApiError(404, "NOT_FOUND", "User not found.");
  if (target.id === admin.id && ((input.role && input.role !== "ADMIN") || (input.status && input.status !== "ACTIVE"))) {
    throw new ApiError(409, "SELF_LOCKOUT", "You cannot demote or suspend your own account.");
  }
  if (target.role === "ADMIN" && ((input.role && input.role !== "ADMIN") || (input.status && input.status !== "ACTIVE"))) {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw new ApiError(409, "LAST_ADMIN", "At least one active admin is required.");
  }
  const role = input.role ?? target.role;
  if (role === "CENTER_STAFF" && !(input.centerId ?? target.centerId)) throw new ApiError(422, "VALIDATION_ERROR", "Assign a center to staff accounts.", { centerId: "Required for center staff" });
  if (role === "HOSPITAL" && !(input.hospitalId ?? target.hospitalId)) throw new ApiError(422, "VALIDATION_ERROR", "Assign a hospital to hospital accounts.", { hospitalId: "Required for hospital accounts" });

  const revoke = (input.role && input.role !== target.role) || (input.status && input.status !== "ACTIVE");
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      role: input.role,
      status: input.status,
      centerId: role === "CENTER_STAFF" ? input.centerId ?? target.centerId : null,
      hospitalId: role === "HOSPITAL" ? input.hospitalId ?? target.hospitalId : null,
      emailVerifiedAt: input.verifyEmail ? target.emailVerifiedAt ?? new Date() : undefined,
      // Role or status change invalidates existing sessions so new permissions apply immediately.
      tokenVersion: revoke ? { increment: 1 } : undefined,
    },
  });
  if (input.status && input.status !== "ACTIVE") {
    await db.donorProfile.updateMany({ where: { userId }, data: { showInSearch: false } });
    await db.donationRequest.updateMany({ where: { donorId: userId, status: "PENDING" }, data: { status: "CANCELLED" } });
  } else if (input.status === "ACTIVE" && target.status !== "ACTIVE") {
    await db.donorProfile.updateMany({ where: { userId }, data: { showInSearch: true } });
  }
  await audit({ actorId: admin.id, action: "admin.user_update", entityType: "User", entityId: userId, ip, meta: { ...input, previous: { role: target.role, status: target.status } } });
  return updated;
}

export async function resolveReport(
  admin: Admin,
  reportId: string,
  input: { status: "REVIEWING" | "RESOLVED" | "DISMISSED"; action: "NONE" | "WARN" | "SUSPEND" | "REMOVE"; adminNote?: string },
  ip?: string,
) {
  assertAdmin(admin);
  const report = await db.report.findUnique({ where: { id: reportId }, include: { bloodRequest: { select: { requesterId: true } } } });
  if (!report) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  const targetId = report.targetUserId ?? report.bloodRequest?.requesterId ?? null;
  if (input.action !== "NONE" && !targetId) throw new ApiError(422, "NO_TARGET", "This report has no user to act on.");

  if (targetId && input.action === "WARN") {
    await db.user.update({ where: { id: targetId }, data: { warnings: { increment: 1 } } });
    await notify([{ userId: targetId, type: "ACCOUNT", title: "Warning from moderators", message: input.adminNote ?? "Your account received a warning for violating community guidelines. Repeated violations may lead to suspension." }], { push: true, email: true });
  }
  if (targetId && (input.action === "SUSPEND" || input.action === "REMOVE")) {
    await updateUserAsAdmin(admin, targetId, { status: input.action === "SUSPEND" ? "SUSPENDED" : "REMOVED" }, ip);
    if (report.bloodRequestId && input.action === "REMOVE") {
      await db.bloodRequest.updateMany({ where: { id: report.bloodRequestId, status: { in: ["DRAFT", "OPEN", "MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED"] } }, data: { status: "CANCELLED", closedAt: new Date() } });
    }
  }
  const updated = await db.report.update({
    where: { id: reportId },
    data: {
      status: input.status,
      action: input.action,
      adminNote: input.adminNote,
      resolvedById: input.status === "REVIEWING" ? null : admin.id,
      resolvedAt: input.status === "REVIEWING" ? null : new Date(),
    },
  });
  if (input.status !== "REVIEWING") {
    await notify([{ userId: report.reporterId, type: "REPORT_UPDATE", title: "Your report was reviewed", message: "Thank you — our moderators reviewed your report and took appropriate action." }]);
  }
  await audit({ actorId: admin.id, action: "admin.report_resolve", entityType: "Report", entityId: reportId, ip, meta: input });
  return updated;
}

export async function sendAnnouncement(admin: Admin, input: { title: string; message: string; audience: Audience; push: boolean }) {
  assertAdmin(admin);
  const roleFilter: Record<Audience, Role[] | null> = { ALL: null, DONORS: ["DONOR"], HOSPITALS: ["HOSPITAL"], STAFF: ["CENTER_STAFF", "ADMIN"] };
  const roles = roleFilter[input.audience];
  const users = await db.user.findMany({ where: { status: "ACTIVE", deletedAt: null, ...(roles ? { role: { in: roles } } : {}) }, select: { id: true } });
  const a = await db.announcement.create({ data: { title: input.title, message: input.message, audience: input.audience, createdById: admin.id, recipients: users.length } });
  // Chunk so very large audiences don't create one giant transaction.
  for (let i = 0; i < users.length; i += 200) {
    await notify(
      users.slice(i, i + 200).map((u) => ({ userId: u.id, type: "ANNOUNCEMENT" as const, title: input.title, message: input.message, link: "/notifications" })),
      { push: input.push },
    );
  }
  await audit({ actorId: admin.id, action: "admin.announcement", entityType: "Announcement", entityId: a.id, meta: { audience: input.audience, recipients: users.length } });
  return a;
}
