import type { Metadata } from "next";
import { ProductCard } from "@/components/product/ProductCard";
import { listProducts } from "@/lib/catalog";
import { messages } from "@/i18n/messages";

export const metadata: Metadata = {
  title: "Aethra",
  description:
    "The Aethra line — the signature pieces that began the house. Drape, asymmetry, and a year of fittings in every cut.",
  alternates: { canonical: "/aethra" },
};

/**
 * Aethra collection — the signature line.
 */
export default async function AethraPage() {
  const products = await listProducts({ collection: "AETHRA" });

  return (
    <div className="container-brand section-y">
      <header className="mb-12 max-w-2xl">
        <p className="text-meta mb-3">{messages.home.collectionsEyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl">aethra</h1>
        <p className="mt-4 text-ink-soft">{messages.home.collectionsAethra.blurb}</p>
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
