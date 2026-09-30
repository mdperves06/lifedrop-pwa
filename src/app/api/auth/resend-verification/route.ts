import { handler, ok } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { sendEmailVerification } from "@/server/services/auth";

export const POST = handler(
  async () => {
    const user = await requireUser();
    if (user.emailVerifiedAt) return ok({ alreadyVerified: true });
    const devVerifyLink = await sendEmailVerification(user);
    return ok({ sent: true, devVerifyLink });
  },
  { rateLimit: { key: "resend", limit: 3, windowMs: 15 * 60_000 } },
);
