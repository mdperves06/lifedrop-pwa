import { NextResponse } from "next/server";
import { handler } from "@/server/http";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const GET = handler(async () => {
  const user = await getSessionUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return NextResponse.json({ data: { unread } }, { headers: { "Cache-Control": "no-store" } });
});
