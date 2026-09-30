import { handler, ok, parseJson, clientIp } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { reportResolveSchema } from "@/lib/validation";
import { resolveReport } from "@/server/services/admin";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, reportResolveSchema);
  const r = await resolveReport(admin, params.id, input, clientIp(req));
  return ok({ id: r.id, status: r.status, action: r.action });
});
