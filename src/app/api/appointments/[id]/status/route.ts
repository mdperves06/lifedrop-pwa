import { z } from "zod";
import { handler, ok, parseJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { setAppointmentStatus } from "@/server/services/appointments";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireRole("CENTER_STAFF", "ADMIN");
  const { status } = await parseJson(req, z.object({ status: z.enum(["CHECKED_IN", "NO_SHOW"]) }));
  await setAppointmentStatus(user, params.id, status);
  return ok({ id: params.id, status });
});
