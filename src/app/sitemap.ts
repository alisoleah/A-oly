import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { locales } from "@/i18n/config";

/**
 * Dynamic sitemap — emits every storefront URL in BOTH locales (en + ar) with
 * hreflang alternates so search engines index the Arabic site separately.
 * Next.js serves this at /sitemap.xml.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_BASE_URL.replace(/\/$/, "");

  // Static storefront paths (relative, no locale prefix yet).
  const staticPaths = ["", "/aether", "/aethra", "/cart"];

  // Product paths from the DB.
  const products = await prisma.product.findMany({
    where: { published: true },
    select: { slug: true, collection: true, updatedAt: true },
  });
  const productPaths = products.map((p) => ({
    path: `/${p.collection.toLowerCase()}/${p.slug}`,
    lastModified: p.updatedAt,
  }));

  const entries: MetadataRoute.Sitemap = [];

  // Emit each path for each locale, with hreflang alternates.
  for (const path of staticPaths) {
    entries.push({
      url: `${base}/en${path}`,
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: {
          en: `${base}/en${path}`,
          ar: `${base}/ar${path}`,
        },
      },
    });
    entries.push({
      url: `${base}/ar${path}`,
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: {
          en: `${base}/en${path}`,
          ar: `${base}/ar${path}`,
        },
      },
    });
  }

  for (const { path, lastModified } of productPaths) {
    for (const locale of locales) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: {
          languages: {
            en: `${base}/en${path}`,
            ar: `${base}/ar${path}`,
          },
        },
      });
    }
  }

  return entries;
}
