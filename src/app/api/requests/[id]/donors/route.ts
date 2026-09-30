import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { sendDonationRequestSchema } from "@/lib/validation";
import { requestDonors } from "@/server/services/requests";

export const POST = handler<{ id: string }>(
  async (req, { params }) => {
    const user = await requireUser();
    const { donorIds, message } = await parseJson(req, sendDonationRequestSchema);
    return ok(await requestDonors(user, params.id, donorIds, message));
  },
  { rateLimit: { key: "request-donors", limit: 30, windowMs: 60 * 60_000 } },
);
