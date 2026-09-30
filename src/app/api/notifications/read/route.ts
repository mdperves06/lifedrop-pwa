import { z } from "zod";
import { handler, ok, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await parseJson(req, z.object({ ids: z.array(z.string().max(40)).max(100).optional(), all: z.boolean().optional() }));
  // Scoped to the caller; already-read notifications are left untouched (idempotent).
  const res = await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return ok({ updated: res.count });
});
