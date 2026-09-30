import { z } from "zod";
import { cookies } from "next/headers";
import { handler, ok, parseJson } from "@/server/http";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { LOCALE_COOKIE } from "@/i18n";

export const POST = handler(async (req) => {
  const { locale } = await parseJson(req, z.object({ locale: z.enum(["en", "bn"]) }));
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  const u = await getSessionUser();
  if (u) await db.user.update({ where: { id: u.id }, data: { locale } });
  return ok({ locale });
});
