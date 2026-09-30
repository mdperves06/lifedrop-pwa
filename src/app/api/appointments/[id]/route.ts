import { z } from "zod";
import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { rescheduleSchema } from "@/lib/validation";
import { cancelAppointment, rescheduleAppointment } from "@/server/services/appointments";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { startsAt } = await parseJson(req, rescheduleSchema);
  const appt = await rescheduleAppointment(user, params.id, startsAt);
  return ok({ id: appt.id, startsAt: appt.startsAt });
});

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const { reason } = z.object({ reason: z.string().trim().max(200).optional() }).parse(body ?? {});
  await cancelAppointment(user, params.id, reason);
  return ok({ cancelled: true });
});
