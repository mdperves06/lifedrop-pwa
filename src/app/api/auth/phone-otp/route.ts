import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { sendPhoneOtp } from "@/server/services/auth";

export const POST = handler(
  async () => {
    const user = await requireUser();
    if (user.phoneVerifiedAt) return ok({ alreadyVerified: true });
    const devCode = await sendPhoneOtp(user);
    return ok({ sent: true, devCode });
  },
  { rateLimit: { key: "otp", limit: 3, windowMs: 10 * 60_000 } },
);
