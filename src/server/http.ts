import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "@/server/env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json({ data }, typeof init === "number" ? { status: init } : init);
}

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json<ApiErrorBody>(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const k = issue.path.join(".") || "_";
      if (!fields[k]) fields[k] = issue.message;
    }
    return NextResponse.json<ApiErrorBody>(
      { error: { code: "VALIDATION_ERROR", message: "Please check the highlighted fields.", details: fields } },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return NextResponse.json<ApiErrorBody>(
        { error: { code: "CONFLICT", message: "That record already exists.", details: err.meta?.target } },
        { status: 409 },
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json<ApiErrorBody>(
        { error: { code: "NOT_FOUND", message: "Not found." } },
        { status: 404 },
      );
    }
  }
  console.error("[api] unhandled error", err);
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler with consistent error handling, CSRF origin checks for
 * state-changing methods, and optional rate limiting.
 */
export function handler<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
  opts: { rateLimit?: { key: string; limit: number; windowMs: number }; skipOriginCheck?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!opts.skipOriginCheck && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        assertSameOrigin(req);
      }
      if (opts.rateLimit) {
        const ip = clientIp(req);
        const r = rateLimit(`${opts.rateLimit.key}:${ip}`, opts.rateLimit.limit, opts.rateLimit.windowMs);
        if (!r.ok) {
          throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a moment and try again.", {
            retryAfterSec: Math.ceil(r.retryAfterMs / 1000),
          });
        }
      }
      const params = (ctx?.params ? await ctx.params : {}) as P;
      return await fn(req, { params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v !== "") obj[k] = v;
  });
  return schema.parse(obj);
}

/**
 * CSRF defence: session cookies are SameSite=Lax, and every state-changing
 * request must additionally carry an Origin (or Referer) matching our host.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin") ?? refererOrigin(req.headers.get("referer"));
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new ApiError(403, "BAD_ORIGIN", "Request origin could not be verified.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "BAD_ORIGIN", "Request origin could not be verified.");
  }
  const allowed = new Set([host]);
  try {
    allowed.add(new URL(env.appUrl).host);
  } catch {}
  if (!allowed.has(originHost)) throw new ApiError(403, "BAD_ORIGIN", "Cross-site request blocked.");
}

function refererOrigin(ref: string | null) {
  if (!ref) return null;
  try {
    return new URL(ref).origin;
  } catch {
    return null;
  }
}

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local"
  );
}

// ── In-memory fixed-window rate limiter ──
// Fine for a single instance. For multi-instance deployments swap for Redis (see SECURITY.md).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterMs: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfterMs: b.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}

export function notFound(what = "Resource"): never {
  throw new ApiError(404, "NOT_FOUND", `${what} not found.`);
}
