/**
 * Catalog data-access layer.
 *
 * All reads of the catalog go through here so the rest of the app works with
 * shaped, typed view-models — never raw Prisma rows leaked into components.
 *
 * Money comes out as integer piasters (see money.ts); components format via
 * formatPrice(). Stock math uses the availability module so the `reserved`
 * field (stock held by PENDING_PAYMENT orders) is never ignored.
 */
import { prisma } from "@/lib/prisma";
import type { Collection, Size } from "@prisma/client";
import type { Piasters } from "@/lib/money";
import { availableStock } from "@/lib/availability";

export type { Collection, Size };

/** A product's price in EGP (integer piasters), derived from its variants' price rows. */
export interface ProductCardVM {
  id: string;
  slug: string;
  name: string;
  collection: Collection;
  /** First colorway's primary image; hover image is the second shot. */
  imagePrimary: { url: string; alt: string };
  imageHover: { url: string; alt: string };
  /** Distinct colorways available, with a swatch hex for the dot. */
  colorways: { name: string; hex: string }[];
  /** Lowest current price across the product's variants (piasters). */
  priceFrom: Piasters;
  /** True if every variant is out of stock. */
  soldOut: boolean;
}

const COLORWAY_HEX: Record<string, string> = {
  ivory: "#EDE7DC",
  ink: "#1A1A1A",
  sand: "#C4A67F",
};

/** Swatch hex for a colorway name (design-system.md palette only). */
export function colorwayHex(name: string): string {
  return COLORWAY_HEX[name.toLowerCase()] ?? "#EDE7DC";
}

/**
 * List published products as card view-models, optionally filtered by collection.
 * Ordered featured-first then by name. Prices are the min unitAmount per product.
 */
export async function listProducts(
  filter?: { collection?: Collection; featuredOnly?: boolean },
): Promise<ProductCardVM[]> {
  const products = await prisma.product.findMany({
    where: {
      published: true,
      ...(filter?.collection ? { collection: filter.collection } : {}),
      ...(filter?.featuredOnly ? { featured: true } : {}),
    },
    include: {
      variants: {
        include: { prices: { where: { currency: "EGP" } } },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });

  return products.map(toCardVM);
}

/** Fetch a single product by slug for the PDP, with everything the page needs. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailVM | null> {
  const product = await prisma.product.findUnique({
    where: { slug, published: true },
    include: {
      variants: {
        include: { prices: { where: { currency: "EGP" } } },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) return null;
  return toDetailVM(product);
}

// ── View-model shaping ───────────────────────────────────────

function toCardVM(p: ProductWithRelations): ProductCardVM {
  const colorways = distinctColorways(p.variants);
  const firstCw = colorways[0]?.name ?? "Ivory";
  const imgs = p.images.filter((i) => i.colorway === firstCw);
  const fallback = p.images[0];

  const amounts = p.variants.flatMap((v) =>
    v.prices.map((pr) => pr.unitAmount),
  );
  const priceFrom = (amounts.length ? Math.min(...amounts) : 0) as Piasters;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    collection: p.collection,
    imagePrimary: {
      url: imgs[0]?.url ?? fallback?.url ?? "",
      alt: imgs[0]?.alt ?? `${p.name}`,
    },
    imageHover: {
      url: imgs[1]?.url ?? imgs[0]?.url ?? fallback?.url ?? "",
      alt: imgs[1]?.alt ?? `${p.name}`,
    },
    colorways: colorways.map((c) => ({ name: c.name, hex: colorwayHex(c.name) })),
    priceFrom,
    soldOut: p.variants.every((v) => v.stock - v.reserved <= 0),
  };
}

function toDetailVM(p: ProductWithRelations): ProductDetailVM {
  const colorways = distinctColorways(p.variants);
  const amounts = p.variants.flatMap((v) => v.prices.map((pr) => pr.unitAmount));
  const priceFrom = (amounts.length ? Math.min(...amounts) : 0) as Piasters;

  // Images grouped per colorway for the gallery.
  const galleryByColorway: Record<string, { url: string; alt: string }[]> = {};
  for (const cw of colorways) {
    galleryByColorway[cw.name] = p.images
      .filter((i) => i.colorway === cw.name)
      .map((i) => ({ url: i.url, alt: i.alt }));
  }

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    collection: p.collection,
    description: p.description,
    fabricNote: p.fabricNote,
    careNote: p.careNote,
    featured: p.featured,
    priceFrom,
    colorways: colorways.map((c) => ({ name: c.name, hex: colorwayHex(c.name) })),
    galleryByColorway,
    /** Per colorway+size availability, keyed `${colorway}:${size}`. */
    variants: p.variants.map((v) => {
      const price = v.prices[0]?.unitAmount ?? priceFrom;
      return {
        id: v.id,
        colorway: v.colorway,
        size: v.size,
        sku: v.sku,
        stock: v.stock,
        reserved: v.reserved,
        available: availableStock(v.stock, v.reserved),
        price: price as Piasters,
      };
    }),
  };
}

/** Distinct colorways in their first-appearance order. */
function distinctColorways(variants: { colorway: string }[]): { name: string }[] {
  const seen = new Set<string>();
  const out: { name: string }[] = [];
  for (const v of variants) {
    if (!seen.has(v.colorway)) {
      seen.add(v.colorway);
      out.push({ name: v.colorway });
    }
  }
  return out;
}

// ── Types (loosened for include shape) ───────────────────────

type ProductWithRelations = {
  id: string;
  slug: string;
  name: string;
  collection: Collection;
  description: string;
  fabricNote: string;
  careNote: string;
  featured: boolean;
  variants: {
    id: string;
    colorway: string;
    size: Size;
    sku: string;
    stock: number;
    reserved: number;
    prices: { unitAmount: number }[];
  }[];
  images: { url: string; alt: string; colorway: string | null }[];
};

export interface ProductDetailVM {
  id: string;
  slug: string;
  name: string;
  collection: Collection;
  description: string;
  fabricNote: string;
  careNote: string;
  featured: boolean;
  priceFrom: Piasters;
  colorways: { name: string; hex: string }[];
  galleryByColorway: Record<string, { url: string; alt: string }[]>;
  variants: {
    id: string;
    colorway: string;
    size: Size;
    sku: string;
    stock: number;
    reserved: number;
    available: number;
    price: Piasters;
  }[];
}

// ── Availability (re-exported for convenience) ───────────────
export { availableStock } from "@/lib/availability";
