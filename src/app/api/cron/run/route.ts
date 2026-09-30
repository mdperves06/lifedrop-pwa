import { timingSafeEqual } from "node:crypto";
import { handler, ok, ApiError } from "@/server/http";
import { env } from "@/server/env";
import { runJobs } from "@/server/jobs";

function authorized(header: string | null) {
  if (!env.cronSecret || !header) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Called by an external scheduler (e.g. Vercel Cron) with `Authorization: Bearer $CRON_SECRET`.
const run = handler(
  async (req) => {
    if (!authorized(req.headers.get("authorization"))) throw new ApiError(401, "UNAUTHORIZED", "Invalid cron secret.");
    return ok(await runJobs());
  },
  { skipOriginCheck: true },
);

export const GET = run;
export const POST = run;
