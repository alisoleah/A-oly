import type { Metadata } from "next";
import { ProductCard } from "@/components/product/ProductCard";
import { listProducts } from "@/lib/catalog";
import { messages } from "@/i18n/messages";

export const metadata: Metadata = {
  title: "Aether",
  description:
    "The Aether line — the foundation wardrobe in wool and cotton. Everyday architecture, made to last.",
  alternates: { canonical: "/aether" },
};

/**
 * Aether collection — the foundation line.
 * Server component; pulls filtered view-models from the catalog layer.
 */
export default async function AetherPage() {
  const products = await listProducts({ collection: "AETHER" });

  return (
    <div className="container-brand section-y">
      <header className="mb-12 max-w-2xl">
        <p className="text-meta mb-3">{messages.home.collectionsEyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl">aether</h1>
        <p className="mt-4 text-ink-soft">{messages.home.collectionsAether.blurb}</p>
      </header>

      {products.length === 0 ? (
        <p className="text-ink-soft py-16 text-center">{messages.product.soldOut}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
