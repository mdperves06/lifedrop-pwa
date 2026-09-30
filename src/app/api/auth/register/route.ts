import { handler, ok, parseJson, clientIp } from "@/server/http";
import { registerSchema } from "@/lib/validation";
import { registerUser } from "@/server/services/auth";
import { setSessionCookie } from "@/server/auth/session";

export const POST = handler(
  async (req) => {
    const input = await parseJson(req, registerSchema);
    const { user, devVerifyLink } = await registerUser(input, clientIp(req));
    await setSessionCookie(user);
    return ok({ id: user.id, devVerifyLink }, 201);
  },
  { rateLimit: { key: "register", limit: 5, windowMs: 60 * 60_000 } },
);
