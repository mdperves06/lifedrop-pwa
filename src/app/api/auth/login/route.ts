import { handler, ok, parseJson, clientIp, rateLimit, ApiError } from "@/server/http";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/services/auth";
import { setSessionCookie } from "@/server/auth/session";

function homeFor(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "CENTER_STAFF") return "/center";
  if (role === "HOSPITAL") return "/hospital";
  return "/dashboard";
}

export const POST = handler(
  async (req) => {
    const { identifier, password } = await parseJson(req, loginSchema);
    // Per-account limit stops password guessing; the looser per-IP limit (below) tolerates shared networks.
    const r = rateLimit(`login-id:${identifier.trim().toLowerCase()}`, 10, 15 * 60_000);
    if (!r.ok) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a moment and try again.", { retryAfterSec: Math.ceil(r.retryAfterMs / 1000) });
    const user = await authenticate(identifier, password, clientIp(req));
    await setSessionCookie(user);
    return ok({ redirect: homeFor(user.role), locale: user.locale });
  },
  { rateLimit: { key: "login", limit: 50, windowMs: 15 * 60_000 } },
);
