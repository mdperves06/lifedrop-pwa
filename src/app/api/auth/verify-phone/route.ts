import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { verifyPhoneSchema } from "@/lib/validation";
import { verifyPhoneCode } from "@/server/services/auth";

export const POST = handler(
  async (req) => {
    const user = await requireUser();
    const { code } = await parseJson(req, verifyPhoneSchema);
    await verifyPhoneCode(user.id, code);
    return ok({ verified: true });
  },
  { rateLimit: { key: "verify-phone", limit: 10, windowMs: 10 * 60_000 } },
);
