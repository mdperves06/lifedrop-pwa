import { NextResponse } from "next/server";
import { handler } from "@/server/http";
import { clearSessionCookie } from "@/server/auth/session";

// Works both as a JSON API call and as a plain <form method="post"> submission.
export const POST = handler(async (req) => {
  await clearSessionCookie();
  if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ data: { ok: true } });
  return NextResponse.redirect(new URL("/?signedOut=1", req.url), 303);
});
