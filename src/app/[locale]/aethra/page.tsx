import type { Metadata } from "next";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Reveal } from "@/components/ui/Reveal";
import { listProducts } from "@/lib/catalog";
import { getMessages } from "@/i18n/get-messages";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Aethra",
    description:
      "The Aethra line — the signature pieces that began the house. Drape, asymmetry, and a year of fittings in every cut.",
    alternates: {
      canonical: `/${locale}/aethra`,
      languages: { en: "/en/aethra", ar: "/ar/aethra" },
    },
  };
}

/**
 * Aethra collection — the signature line.
 */
export default async function AethraPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = getMessages(locale as Locale);
  const products = await listProducts({ collection: "AETHRA" });

  return (
    <div className="container-brand section-y">
      <Reveal>
        <header className="mb-12 max-w-2xl">
          <p className="text-meta mb-3">{messages.home.collectionsEyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl lowercase">{messages.home.collectionsAethra.name}</h1>
          <p className="mt-4 text-ink-soft">{messages.home.collectionsAethra.blurb}</p>
        </header>
      </Reveal>

      <ProductGrid products={products} />
    </div>
  );
}
