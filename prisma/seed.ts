/**
 * Seed the 5 launch styles (CLAUDE.md §Seed data).
 *
 * Prices stored as integer piasters (EGP × 100):
 *   Signature Asymmetric Draped Pants (Aethra) — EGP 3,200 → 320_000
 *   Wide-Leg Trouser            (Aether)       — EGP 2,900 → 290_000
 *   Tailored Blazer             (Aethra)       — EGP 5,500 → 550_000
 *   Fluid Shirt                 (Aether)       — EGP 2,200 → 220_000
 *   Column Dress                (Aether)       — EGP 3,800 → 380_000
 *
 * Two colorways each (Ivory/Ink except blazer: Ink/Sand), sizes XS–XL, stock 6/variant.
 * Idempotent: re-running updates in place (upsert by slug/sku) rather than duplicating.
 */
import { PrismaClient, Collection, Size } from "@prisma/client";

const prisma = new PrismaClient();

const SIZES: Size[] = [Size.XS, Size.S, Size.M, Size.L, Size.XL];
const STOCK_PER_VARIANT = 6;

type SeedProduct = {
  slug: string;
  name: string;
  collection: Collection;
  pricePiasters: number;
  colorways: string[];
  description: string;
  fabricNote: string;
  careNote: string;
  featured?: boolean;
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "signature-asymmetric-draped-pants",
    name: "Signature Asymmetric Draped Pants",
    collection: Collection.AETHRA,
    pricePiasters: 320_000,
    colorways: ["Ivory", "Ink"],
    description:
      "The piece that began the house. An asymmetric drape that falls from the hip into a fluid wide leg — cut once, perfected over a year of fittings. Restrained at the waist, generous through the hem.",
    fabricNote:
      "Heavyweight crepe with a dry hand and quiet movement. Sourced from a Como mill that has woven for couture houses since 1947.",
    careNote: "Dry clean only. Steam on a low setting to restore the drape.",
    featured: true,
  },
  {
    slug: "wide-leg-trouser",
    name: "Wide-Leg Trouser",
    collection: Collection.AETHER,
    pricePiasters: 290_000,
    colorways: ["Ivory", "Ink"],
    description:
      "A high-waisted wide-leg trouser with a clean front and a single pressed crease. The everyday architecture of a wardrobe, made to last.",
    fabricNote:
      "Wool-blend suiting with structure and breathability — holds its line through a full day of wear.",
    careNote: "Dry clean recommended. Hang on a clipped hanger overnight to release wrinkles.",
  },
  {
    slug: "tailored-blazer",
    name: "Tailored Blazer",
    collection: Collection.AETHRA,
    pricePiasters: 550_000,
    colorways: ["Ink", "Sand"],
    description:
      "A single-button tailored blazer with a softly structured shoulder and a nipped waist. Cut to layer over everything and elevate anything.",
    fabricNote:
      "Italian woven suiting with a matte finish and a touch of stretch for ease through the shoulder.",
    careNote: "Dry clean only. Store on a broad padded hanger to preserve the shoulder line.",
    featured: true,
  },
  {
    slug: "fluid-shirt",
    name: "Fluid Shirt",
    collection: Collection.AETHER,
    pricePiasters: 220_000,
    colorways: ["Ivory", "Ink"],
    description:
      "A relaxed shirt in fluid cotton-poplin with a clean collar and a dropped shoulder. The foundation piece — wear it open, tucked, or alone.",
    fabricNote: "Long-staple cotton poplin, garment-washed for a soft, lived-in hand.",
    careNote: "Machine wash cold, hang dry. Iron on medium while slightly damp for a crisp finish.",
  },
  {
    slug: "column-dress",
    name: "Column Dress",
    collection: Collection.AETHER,
    pricePiasters: 380_000,
    colorways: ["Ivory", "Ink"],
    description:
      "A floor-skimming column dress in fluid crepe with a cowl back and a bias-cut hem. The one-piece answer to an evening that matters.",
    fabricNote: "Sandwashed crepe that drapes like silk with the ease of a jersey.",
    careNote: "Dry clean or hand wash cold. Dry flat to preserve the bias drape.",
  },
];

async function main() {
  for (const p of PRODUCTS) {
    // 1. Product
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        collection: p.collection,
        description: p.description,
        fabricNote: p.fabricNote,
        careNote: p.careNote,
        featured: p.featured ?? false,
        published: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        collection: p.collection,
        description: p.description,
        fabricNote: p.fabricNote,
        careNote: p.careNote,
        featured: p.featured ?? false,
        published: true,
      },
    });

    // 2. Images per colorway (placeholder SVGs from scripts/generate-placeholders.ts)
    for (const [i, cw] of p.colorways.entries()) {
      for (const shot of [1, 2]) {
        await prisma.image.upsert({
          where: { id: `${product.id}-${cw}-${shot}` },
          update: {},
          create: {
            id: `${product.id}-${cw}-${shot}`,
            productId: product.id,
            colorway: cw,
            url: `/images/products/${p.slug}-${cw.toLowerCase()}-${shot}.svg`,
            alt: `${p.name} in ${cw}, ${shot === 1 ? "front view" : "fabric detail"}`,
            sortOrder: i * 2 + shot,
          },
        });
      }
    }

    // 3. Variants: every colorway × size, each with a price row
    for (const cw of p.colorways) {
      for (const size of SIZES) {
        const sku = `${p.slug}-${cw.toLowerCase()}-${size.toLowerCase()}`.slice(0, 60);
        const variant = await prisma.variant.upsert({
          where: { sku },
          update: {
            stock: STOCK_PER_VARIANT,
            colorway: cw,
            size,
            productId: product.id,
          },
          create: {
            sku,
            productId: product.id,
            colorway: cw,
            size,
            stock: STOCK_PER_VARIANT,
            weightGrams: 500,
          },
        });

        await prisma.price.upsert({
          where: {
            variantId_currency: { variantId: variant.id, currency: "EGP" },
          },
          update: { unitAmount: p.pricePiasters },
          create: {
            variantId: variant.id,
            currency: "EGP",
            unitAmount: p.pricePiasters,
          },
        });
      }
    }
  }

  const counts = await prisma.$transaction([
    prisma.product.count(),
    prisma.variant.count(),
    prisma.price.count(),
    prisma.image.count(),
  ]);
  console.log(
    `✓ seeded: ${counts[0]} products, ${counts[1]} variants, ${counts[2]} prices, ${counts[3]} images`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
