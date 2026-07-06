import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/product/Gallery";
import { BuyPanel } from "@/components/product/BuyPanel";
import { getProductBySlug, type ProductDetailVM } from "@/lib/catalog";
import { env } from "@/lib/env";
import { messages } from "@/i18n/messages";

/**
 * Shared product detail view, used by /aether/[slug] and /aethra/[slug].
 * Collection in the URL is cosmetic (both paths resolve by slug); the canonical
 * path always matches the product's real collection so links stay clean.
 */

export async function loadProductDetail(slug: string): Promise<ProductDetailVM> {
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  return product;
}

export function buildProductMetadata(p: ProductDetailVM): Metadata {
  const image = p.galleryByColorway[p.colorways[0]?.name ?? ""]?.[0];
  return {
    title: p.name,
    description: p.description.slice(0, 155),
    alternates: { canonical: `/${p.collection.toLowerCase()}/${p.slug}` },
    openGraph: {
      type: "website",
      title: `${p.name} — ${messages.brand.name}`,
      description: p.description.slice(0, 155),
      url: `${env.APP_BASE_URL}/${p.collection.toLowerCase()}/${p.slug}`,
      images: image ? [{ url: image.url, alt: image.alt }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: p.name,
      description: p.description.slice(0, 155),
      images: image ? [image.url] : [],
    },
  };
}

/**
 * JSON-LD Product schema for rich results.
 * Offers the lowest-price variant; availability aggregated across variants.
 */
export function buildProductJsonLd(p: ProductDetailVM) {
  const anyInStock = p.variants.some((v) => v.available > 0);
  const image = p.galleryByColorway[p.colorways[0]?.name ?? ""]?.[0]?.url;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: image ? [`${env.APP_BASE_URL}${image}`] : undefined,
    brand: { "@type": "Brand", name: messages.brand.name },
    category: p.collection,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EGP",
      lowPrice: (p.priceFrom / 100).toString(),
      offerCount: p.variants.length,
      availability: anyInStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}

export function ProductDetailView({ product }: { product: ProductDetailVM }) {
  const initialColorway = product.colorways[0]?.name ?? "";
  const gallery = product.galleryByColorway[initialColorway] ?? [];

  return (
    <div className="container-brand section-y">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
        {/* Gallery — 60% on desktop */}
        <Gallery images={gallery} />

        {/* Buy panel — 40% on desktop, sticky */}
        <div>
          <BuyPanel
            productName={product.name}
            collection={product.collection}
            colorways={product.colorways}
            variants={product.variants}
            priceFrom={product.priceFrom}
            fabricNote={product.fabricNote}
            careNote={product.careNote}
            description={product.description}
          />
        </div>
      </div>
    </div>
  );
}
