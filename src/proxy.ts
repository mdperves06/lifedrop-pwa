import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (cookie presence). Real authentication + authorization
// happens server-side in every page (requirePageUser) and API route (requireUser/requireRole).
const PRIVATE = ["/dashboard", "/profile", "/my-requests", "/incoming", "/appointments", "/notifications", "/admin", "/center", "/hospital"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPrivate = PRIVATE.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPrivate && !req.cookies.has("ld_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname + search);
  const res = NextResponse.next({ request: { headers } });
  if (isPrivate) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|icon.svg).*)"],
};
