import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { appointmentSchema } from "@/lib/validation";
import { bookAppointment } from "@/server/services/appointments";

export const POST = handler(
  async (req) => {
    const user = await requireUser();
    const input = await parseJson(req, appointmentSchema);
    const appt = await bookAppointment(user.id, input);
    return ok({ id: appt.id, startsAt: appt.startsAt, status: appt.status }, 201);
  },
  { rateLimit: { key: "book", limit: 20, windowMs: 60 * 60_000 } },
);
