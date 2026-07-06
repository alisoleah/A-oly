import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Robots — allow all crawling, point to the sitemap. Admin is disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cart"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
