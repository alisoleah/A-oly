import type { Metadata } from "next";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
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
      <Reveal>
        <header className="mb-12 max-w-2xl">
          <p className="text-meta mb-3">{messages.home.collectionsEyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl">aether</h1>
          <p className="mt-4 text-ink-soft">{messages.home.collectionsAether.blurb}</p>
        </header>
      </Reveal>

      <ProductGrid products={products} />
    </div>
  );
}
