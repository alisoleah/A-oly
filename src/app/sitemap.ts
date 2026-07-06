import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Dynamic sitemap — home, collections, and every published product.
 * Next.js serves this at /sitemap.xml.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_BASE_URL.replace(/\/$/, "");

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/aether`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/aethra`, changeFrequency: "weekly", priority: 0.8 },
  ];

  const products = await prisma.product.findMany({
    where: { published: true },
    select: { slug: true, collection: true, updatedAt: true },
  });

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/${p.collection.toLowerCase()}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries];
}
