import { z } from "zod";
import { handler, ok, parseQuery } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const { cursor } = parseQuery(req, z.object({ cursor: z.string().max(40).optional() }));
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true },
  });
  return ok({ items, nextCursor: items.length === 30 ? items.at(-1)!.id : null });
});
