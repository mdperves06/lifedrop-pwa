import "server-only";
import { redirect, forbidden } from "next/navigation";
import { headers } from "next/headers";
import type { Role } from "@prisma/client";
import { getSessionUser, type SessionUser } from "@/server/auth/session";

/** For server components: require a signed-in user (and optionally a role) or redirect. */
export async function requirePageUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const h = await headers();
    const next = h.get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (roles.length && !roles.includes(user.role)) forbidden();
  return user;
}
