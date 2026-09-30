import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { bloodRequestSchema } from "@/lib/validation";
import { createBloodRequest } from "@/server/services/requests";
import { publicRequestBoard } from "@/server/services/request-views";

export const GET = handler(async () => {
  return ok(await publicRequestBoard(30));
});

export const POST = handler(
  async (req) => {
    const user = await requireUser();
    const input = await parseJson(req, bloodRequestSchema);
    const { request, autoNotified } = await createBloodRequest(user, input);
    return ok({ id: request.id, status: request.status, autoNotified }, 201);
  },
  { rateLimit: { key: "create-request", limit: 10, windowMs: 60 * 60_000 } },
);
