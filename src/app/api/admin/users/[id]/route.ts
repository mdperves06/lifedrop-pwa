import { handler, ok, parseJson, clientIp } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { adminUserUpdateSchema } from "@/lib/validation";
import { updateUserAsAdmin } from "@/server/services/admin";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseJson(req, adminUserUpdateSchema);
  const u = await updateUserAsAdmin(admin, params.id, input, clientIp(req));
  return ok({ id: u.id, role: u.role, status: u.status });
});
