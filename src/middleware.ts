import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/admin/auth";

/**
 * Admin middleware — the single gate protecting EVERY /admin route and admin
 * API/server action (security audit area C).
 *
 * App Router makes it easy to miss a route segment, so this matcher is broad:
 * anything under /admin (pages) or /api/admin (mutations) requires a valid
 * signed session. Unauthenticated → redirect to /admin/login (pages) or 401
 * (API). The session is verified by re-checking the JWT signature + expiry on
 * every request — never trusts a cookie's presence alone.
 */

const PUBLIC_ADMIN = ["/admin/login", "/api/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only gate admin territory.
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // The login page itself must be reachable without a session.
  if (PUBLIC_ADMIN.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);

  if (!session) {
    if (isAdminApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Pages: redirect to login, remembering where to return.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on admin pages + admin API. Everything else (storefront, webhooks,
  // public cart) is intentionally untouched.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
