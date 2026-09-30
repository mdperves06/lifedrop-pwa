import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { respondSchema } from "@/lib/validation";
import { respondToDonationRequest } from "@/server/services/requests";

// Also called by the service worker's notification Accept / Decline actions.
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { action } = await parseJson(req, respondSchema);
  const dr = await respondToDonationRequest(user.id, params.id, action);
  return ok({ id: dr.id, status: dr.status });
});
