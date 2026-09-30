import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { reportSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { notifyAdmins } from "@/server/notify";

export const POST = handler(
  async (req) => {
    const user = await requireUser();
    const input = await parseJson(req, reportSchema);
    if (input.targetUserId === user.id) throw new ApiError(422, "SELF_REPORT", "You cannot report yourself.");
    if (input.targetUserId && !(await db.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } }))) throw new ApiError(404, "NOT_FOUND", "User not found.");
    if (input.bloodRequestId && !(await db.bloodRequest.findUnique({ where: { id: input.bloodRequestId }, select: { id: true } }))) throw new ApiError(404, "NOT_FOUND", "Request not found.");
    // One open report per reporter/target to avoid spam.
    const dup = await db.report.findFirst({
      where: { reporterId: user.id, targetUserId: input.targetUserId ?? null, bloodRequestId: input.bloodRequestId ?? null, status: { in: ["PENDING", "REVIEWING"] } },
    });
    if (dup) return ok({ id: dup.id, duplicate: true });
    const report = await db.report.create({ data: { reporterId: user.id, targetUserId: input.targetUserId, bloodRequestId: input.bloodRequestId, reason: input.reason, details: input.details } });
    await notifyAdmins({ type: "REPORT_UPDATE", title: "New report", message: `A user reported: ${input.reason.replaceAll("_", " ").toLowerCase()}.`, link: "/admin/reports" });
    return ok({ id: report.id }, 201);
  },
  { rateLimit: { key: "report", limit: 10, windowMs: 60 * 60_000 } },
);
