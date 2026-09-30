import { z } from "zod";
import { handler, ok, parseJson, ApiError } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { pushSubscribeSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { pushEnabled } from "@/server/notify/channels";

export const POST = handler(async (req) => {
  const user = await requireUser();
  if (!pushEnabled()) throw new ApiError(503, "PUSH_DISABLED", "Push notifications are not configured on this server.");
  const sub = await parseJson(req, pushSubscribeSchema);
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return ok({ subscribed: true }, 201);
});

export const DELETE = handler(async (req) => {
  const user = await requireUser();
  const { endpoint } = await parseJson(req, z.object({ endpoint: z.string().max(1000) }));
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return ok({ unsubscribed: true });
});
