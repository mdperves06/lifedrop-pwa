import { handler, ok, parseJson } from "@/server/http";
import { verifyEmailSchema } from "@/lib/validation";
import { verifyEmailToken } from "@/server/services/auth";

export const POST = handler(
  async (req) => {
    const { token } = await parseJson(req, verifyEmailSchema);
    await verifyEmailToken(token);
    return ok({ verified: true });
  },
  { rateLimit: { key: "verify-email", limit: 20, windowMs: 15 * 60_000 } },
);
