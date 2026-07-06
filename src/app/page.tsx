import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icon";
import { ProductCard } from "@/components/product/ProductCard";
import { listProducts } from "@/lib/catalog";
import { messages } from "@/i18n/messages";
import { formatPrice } from "@/lib/money";

/**
 * Home — hero, collection blocks, featured grid, and the full catalog.
 * Server component: pulls shaped view-models from the catalog layer.
 */
export default async function HomePage() {
  const [featured, all] = await Promise.all([
    listProducts({ featuredOnly: true }),
    listProducts(),
  ]);
  const signature = featured[0];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden bg-ivory-deep">
        <div
          className="absolute inset-0 bg-gradient-to-b from-ivory via-ivory-deep to-ivory"
          aria-hidden
        />
        <div className="container-brand relative z-10 flex flex-col items-center text-center">
          <p className="text-meta mb-6">{messages.home.heroEyebrow}</p>
          <h1 className="font-display text-[2.25rem] leading-[2.75rem] sm:text-5xl md:text-[3.5rem] md:leading-[4rem] max-w-3xl">
            {messages.home.heroTitle}
          </h1>
          <p className="mt-6 max-w-xl text-ink-soft">{messages.home.heroBody}</p>
          <Button href="/aethra" variant="ghost" className="mt-10">
            {messages.home.heroCta}
            <ArrowRightIcon className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Collections ──────────────────────────────────────── */}
      <section className="section-y">
        <div className="container-brand">
          <div className="mb-12 text-center">
            <p className="text-meta mb-3">{messages.home.collectionsEyebrow}</p>
            <h2 className="font-display text-3xl md:text-4xl">
              {messages.home.collectionsTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <CollectionBlock
              href="/aether"
              name={messages.home.collectionsAether.name}
              blurb={messages.home.collectionsAether.blurb}
              tone="light"
            />
            <CollectionBlock
              href="/aethra"
              name={messages.home.collectionsAethra.name}
              blurb={messages.home.collectionsAethra.blurb}
              tone="dark"
            />
          </div>
        </div>
      </section>

      {/* ── Featured piece ───────────────────────────────────── */}
      {signature && (
        <section className="section-y bg-ivory-deep">
          <div className="container-brand grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <Link
              href={`/aethra/${signature.slug}`}
              className="group relative aspect-[4/5] overflow-hidden bg-ink"
            >
              <Image
                src={signature.imagePrimary.url}
                alt={signature.imagePrimary.alt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition-transform duration-[var(--animate-duration-slow)] ease-[var(--ease-brand)] group-hover:scale-[1.02]"
                priority
              />
            </Link>
            <div>
              <p className="text-meta mb-3">{messages.home.featuredEyebrow}</p>
              <h2 className="font-display text-3xl md:text-4xl mb-4">
                {signature.name}
              </h2>
              <p className="text-price text-ink mb-6">{formatPrice(signature.priceFrom)}</p>
              <p className="text-ink-soft mb-8 max-w-md">{messages.home.featuredBody}</p>
              <Button href={`/aethra/${signature.slug}`} variant="primary">
                {messages.product.addToCart}
                <ArrowRightIcon className="ms-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── The collection ───────────────────────────────────── */}
      {all.length > 0 && (
        <section className="section-y">
          <div className="container-brand">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="text-meta mb-2">{messages.home.collectionsEyebrow}</p>
                <h2 className="font-display text-3xl md:text-4xl">the collection</h2>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8">
              {all.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

function CollectionBlock({
  href,
  name,
  blurb,
  tone,
}: {
  href: string;
  name: string;
  blurb: string;
  tone: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden p-8 md:p-10 transition-colors duration-[var(--animate-duration-base)] ${
        tone === "dark" ? "bg-ink text-ivory" : "bg-ivory text-ink border border-line"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-3xl md:text-4xl lowercase">{name}</h3>
          <p className={`mt-2 max-w-xs text-sm ${tone === "dark" ? "text-ivory/70" : "text-ink-soft"}`}>
            {blurb}
          </p>
        </div>
        <ArrowRightIcon
          className={`h-6 w-6 transition-transform duration-[var(--animate-duration-base)] group-hover:translate-x-1 ${
            tone === "dark" ? "text-gold-soft" : "text-gold"
          }`}
        />
      </div>
    </Link>
  );
}
