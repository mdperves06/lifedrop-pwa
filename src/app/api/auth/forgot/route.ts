import { handler, ok, parseJson, clientIp } from "@/server/http";
import { forgotSchema } from "@/lib/validation";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = handler(
  async (req) => {
    const { email } = await parseJson(req, forgotSchema);
    const devResetLink = await requestPasswordReset(email, clientIp(req));
    return ok({ sent: true, devResetLink });
  },
  { rateLimit: { key: "forgot", limit: 5, windowMs: 15 * 60_000 } },
);
