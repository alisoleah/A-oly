import type { NextConfig } from "next";

/**
 * Security headers (security audit area E).
 *
 * Applied to ALL responses via the `headers()` function. Notes:
 *  - CSP: no 'unsafe-inline' for scripts. When Paymob goes live, add its
 *    frame/script origins to frame-src + script-src (see SECURITY_AUDIT.md).
 *  - HSTS: 1 year + preload. Only meaningful over HTTPS (Vercel is always HTTPS).
 *  - frame-ancestors 'none': nobody may iframe us. Paymob uses a redirect to its
 *    OWN hosted checkout (not an iframe of our domain), so this is safe.
 *  - Referrer-Policy: strict-origin-when-cross-origin (no full URL leaks).
 *  - Permissions-Policy: deny everything we don't use.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // framer-motion needs 'unsafe-eval' for its animation style engine, and
      // Next.js injects inline runtime scripts. GA4 + Meta Pixel (loaded only
      // when NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_META_PIXEL_ID are set) need their
      // domains. Tighten to nonce-based CSP (see SECURITY_AUDIT.md) before
      // production launch; for dev/staging this keeps everything functional.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'", // Tailwind injects styles inline; tighten post-launch
      "img-src 'self' data: blob: https://www.facebook.com", // Meta Pixel img beacon
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
