import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/admin/auth";
import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * Middleware — locale routing + admin gating.
 *
 * Two responsibilities, run in order:
 *
 * 1. LOCALE ROUTING (storefront paths only)
 *    - `/` → detect locale (NEXT_LOCALE cookie → Accept-Language → default) →
 *      redirect to `/{locale}`
 *    - `/{locale}/...` → valid locale prefix; sync NEXT_LOCALE cookie, pass through
 *    - `/aethra`, `/cart`, etc. (storefront without prefix) → redirect to
 *      `/{detected}/aethra`, etc. so every storefront URL is locale-prefixed
 *    - Admin, API, mock-pay, static assets → bypass locale logic entirely
 *
 * 2. ADMIN GATING (security audit area C)
 *    - `/admin/*` and `/api/admin/*` require a valid signed session (JWT verified
 *      on every request). Unauthenticated → redirect to login (pages) or 401 (API).
 *
 * The matcher excludes everything that must be locale-neutral: /api, /admin,
 * /mock-pay, /_next, and static files.
 */

const PUBLIC_ADMIN = ["/admin/login", "/api/admin/login"];

// Storefront routes that live under [locale]/ — used to detect unprefixed
// storefront paths that need redirecting to /{locale}/...
const STOREFRONT_SEGMENTS = ["aether", "aethra", "cart", "checkout", "orders"];

/**
 * Detect the user's preferred locale: NEXT_LOCALE cookie → Accept-Language → default.
 */
function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (isLocale(cookie)) return cookie;

  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    // Simple parse: look for "ar" in the header. Full RFC parsing is overkill
    // for a two-locale site.
    if (acceptLang.toLowerCase().startsWith("ar") || acceptLang.includes(",ar")) {
      return "ar";
    }
  }
  return defaultLocale;
}

/** Set the NEXT_LOCALE cookie so subsequent visits skip detection. */
function withLocaleCookie(response: NextResponse, locale: string): NextResponse {
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // readable by the locale switcher (client)
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin gating (unchanged logic, just relocated below locale check) ──
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (isAdminPage || isAdminApi) {
    if (PUBLIC_ADMIN.some((p) => pathname === p)) {
      return NextResponse.next();
    }
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = await verifyAdminSession(token);
    if (!session) {
      if (isAdminApi) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Locale routing (storefront) ──

  // Root → redirect to detected locale.
  if (pathname === "/") {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return withLocaleCookie(NextResponse.redirect(url), locale);
  }

  // Check if path starts with a valid locale prefix.
  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  if (isLocale(maybeLocale)) {
    // Already locale-prefixed — sync cookie + pass through.
    const res = NextResponse.next();
    if (request.cookies.get("NEXT_LOCALE")?.value !== maybeLocale) {
      res.cookies.set("NEXT_LOCALE", maybeLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return res;
  }

  // Storefront path without locale prefix (e.g. /aethra) → redirect to /{locale}/aethra.
  if (STOREFRONT_SEGMENTS.includes(maybeLocale ?? "")) {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return withLocaleCookie(NextResponse.redirect(url), locale);
  }

  return NextResponse.next();
}

export const config = {
  // Match storefront + admin, but exclude: API routes, _next, static files,
  // mock-pay (payment return — locale-neutral), robots, sitemap.
  matcher: [
    /*
     * Match all paths except:
     * - /api (API routes — locale-neutral)
     * - /_next (Next internals)
     * - /mock-pay (payment provider return URLs)
     * - static files (with dots in the last segment)
     */
    "/((?!api|_next|mock-pay|admin|robots.txt|sitemap.xml|.*\\..*).*)",
    // Admin routes (separate matcher so the function runs on them too).
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
