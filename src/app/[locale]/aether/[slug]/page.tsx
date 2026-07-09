import {
  buildProductJsonLd,
  buildProductMetadata,
  loadProductDetail,
  ProductDetailView,
} from "@/components/product/ProductDetail";

/**
 * /aether/[slug] — Aether-line product detail.
 * Resolves by slug; notFound() (404) if missing or unpublished.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const product = await loadProductDetail(slug);
  return buildProductMetadata(product);
}

export default async function AetherProductPage({
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
