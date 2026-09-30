import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { ApiError } from "@/server/http";

export const SESSION_COOKIE = "ld_session";

export type SessionClaims = { sub: string; role: Role; tv: number };

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

function key() {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function signSession(claims: SessionClaims) {
  return new SignJWT({ role: claims.role, tv: claims.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("lifedrop")
    .setExpirationTime(`${env.sessionDays}d`)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "lifedrop", algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string" || typeof payload.tv !== "number") return null;
    return { sub: payload.sub, role: payload.role as Role, tv: payload.tv };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: { id: string; role: Role; tokenVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role, tv: user.tokenVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: env.sessionDays * 86_400,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  locale: true,
  tokenVersion: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  centerId: true,
  hospitalId: true,
  avatarPath: true,
  locationId: true,
  lastActiveAt: true,
  donorProfile: { select: { bloodGroup: true, availability: true } },
} as const;

/**
 * The authoritative session check. Verifies the JWT, then confirms against the
 * database that the account still exists, is active, and that the token has not
 * been revoked (tokenVersion). Cached per request.
 */
export const getSessionUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.sub }, select: sessionUserSelect });
  if (!user || user.status !== "ACTIVE" || user.tokenVersion !== claims.tv) return null;
  // Throttled "last active" bump (used for the "recently active" donor filter).
  if (Date.now() - user.lastActiveAt.getTime() > 15 * 60_000) {
    await db.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  return user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  assertRole(user, ...roles);
  return user;
}

export function assertRole(user: { role: Role }, ...roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to do that.");
  }
}

export function isVerified(user: { emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null }) {
  return !!(user.emailVerifiedAt || user.phoneVerifiedAt);
}
