import {
  buildProductJsonLd,
  buildProductMetadata,
  loadProductDetail,
  ProductDetailView,
} from "@/components/product/ProductDetail";
import { locales } from "@/i18n/config";
import { prisma } from "@/lib/prisma";

/**
 * /aethra/[slug] — Aethra-line product detail.
 * Resolves by slug; notFound() (404) if missing or unpublished.
 */

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { published: true, collection: "AETHRA" },
    select: { slug: true },
  });
  return locales.flatMap((locale) =>
    products.map((p) => ({ locale, slug: p.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const product = await loadProductDetail(slug);
  return buildProductMetadata(product);
}

export default async function AethraProductPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  const product = await loadProductDetail(slug);

  const jsonLd = buildProductJsonLd(product);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailView product={product} />
    </>
  );
}
