import { handler, ok, parseJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { recordDonationSchema } from "@/lib/validation";
import { recordDonation } from "@/server/services/inventory";

export const POST = handler(async (req) => {
  const user = await requireRole("CENTER_STAFF", "ADMIN");
  const input = await parseJson(req, recordDonationSchema);
  const d = await recordDonation(user, input);
  return ok({ id: d.id, certificateNo: d.certificateNo }, 201);
});
