import { handler, ok, parseJson, clientIp } from "@/server/http";
import { resetSchema } from "@/lib/validation";
import { resetPassword } from "@/server/services/auth";
import { clearSessionCookie } from "@/server/auth/session";

export const POST = handler(
  async (req) => {
    const { token, password } = await parseJson(req, resetSchema);
    await resetPassword(token, password, clientIp(req));
    await clearSessionCookie();
    return ok({ reset: true });
  },
  { rateLimit: { key: "reset", limit: 10, windowMs: 15 * 60_000 } },
);
