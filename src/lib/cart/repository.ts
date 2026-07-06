import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  availableStock,
  maxAddableQty,
} from "@/lib/availability";
import {
  assertPiasters,
  multiplyPrice,
  sumPiasters,
  type Piasters,
} from "@/lib/money";
import {
  generateCartToken,
  getCartToken,
  setCartCookie,
} from "@/lib/cart/cookies";

/**
 * Cart repository — the ONLY module that reads/writes cart rows.
 *
 * INVARIANTS (CLAUDE.md non-negotiable #4):
 *  - Totals are recomputed server-side from DB prices; client totals ignored.
 *  - Quantities are capped at available stock (stock − reserved) on every write.
 *  - The cart is identified by an unguessable cookie token, never a client-sent id.
 */

const CART_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

/**
 * Ensure a cart exists for the current visitor, creating one (and setting the
 * cookie) if none exists yet.
 *
 * ⚠️ Mutates the response — call ONLY from a Server Action or Route Handler.
 * (Next.js forbids `cookies().set()` inside Server Components.)
 */
export async function ensureCartToken(): Promise<string> {
  const existing = await getCartToken();
  if (existing) {
    const found = await prisma.cart.findUnique({
      where: { cookieToken: existing },
      select: { cookieToken: true },
    });
    if (found) return found.cookieToken;
  }
  const token = generateCartToken();
  await prisma.cart.create({
    data: {
      cookieToken: token,
      expiresAt: new Date(Date.now() + CART_TTL_MS),
    },
  });
  await setCartCookie(token);
  return token;
}

/**
 * Read the visitor's existing cart token — read-only, safe inside a Server
 * Component. Returns null when there's no cart yet (the visitor hasn't added
 * anything). Creating a cart requires a mutation, which RSC can't do.
 */
export async function readCartTokenForRSC(): Promise<string | null> {
  const existing = await getCartToken();
  if (!existing) return null;
  const found = await prisma.cart.findUnique({
    where: { cookieToken: existing },
    select: { cookieToken: true },
  });
  return found?.cookieToken ?? null;
}

/** Load the cart for an RSC: empty if no cart yet (no cookie creation). */
export async function loadCartForRSC(): Promise<CartVM> {
  const token = await readCartTokenForRSC();
  if (!token) return EMPTY_CART("none");
  return loadCart(token);
}

/** Internal: count items in a cart for the header badge. */
export async function countCartItems(token: string): Promise<number> {
  const rows = await prisma.cartItem.aggregate({
    where: { cart: { cookieToken: token } },
    _sum: { qty: true },
  });
  return rows._sum.qty ?? 0;
}

// ── View-model types ─────────────────────────────────────────

export interface CartLineVM {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  colorway: string;
  size: string;
  image: { url: string; alt: string };
  unitAmount: Piasters; // from DB Price, NOT the client
  qty: number;
  lineTotal: Piasters;
  /** What the customer may still add to this line. */
  maxQty: number;
  /** Whether the line is still in stock. */
  available: number;
}

export interface CartVM {
  token: string;
  lines: CartLineVM[];
  itemCount: number;
  subtotal: Piasters;
  shipping: Piasters;
  total: Piasters;
  /** Remaining spend to unlock free shipping (0 if already unlocked). */
  freeShippingRemaining: Piasters;
  freeShippingThreshold: Piasters;
}

const EMPTY_CART = (token: string): CartVM => ({
  token,
  lines: [],
  itemCount: 0,
  subtotal: 0 as Piasters,
  shipping: 0 as Piasters,
  total: 0 as Piasters,
  freeShippingRemaining: env.FREE_SHIPPING_THRESHOLD_PIASTERS,
  freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD_PIASTERS,
});

/**
 * Load the full cart view-model with SERVER-COMPUTED totals.
 * Prices come straight from the Price table (currency EGP); the line totals,
 * subtotal, shipping, and total are all derived here — never accepted from client.
 */
export async function loadCart(token: string): Promise<CartVM> {
  const cart = await prisma.cart.findUnique({
    where: { cookieToken: token },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: { orderBy: { sortOrder: "asc" }, take: 1 },
                },
              },
              prices: { where: { currency: "EGP" } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart) return EMPTY_CART(token);

  const lines: CartLineVM[] = cart.items.map((item) => {
    const unit = item.variant.prices[0]?.unitAmount ?? 0;
    assertPiasters(unit, "cart line unit price");
    const available = availableStock(item.variant.stock, item.variant.reserved);
    return {
      id: item.id,
      variantId: item.variantId,
      productId: item.variant.productId,
      slug: item.variant.product.slug,
      name: item.variant.product.name,
      colorway: item.variant.colorway,
      size: item.variant.size,
      image: {
        url: item.variant.product.images[0]?.url ?? "",
        alt: item.variant.product.images[0]?.alt ?? item.variant.product.name,
      },
      unitAmount: unit,
      qty: item.qty,
      lineTotal: multiplyPrice(unit, item.qty),
      maxQty: maxAddableQty(item.variant.stock, item.variant.reserved),
      available,
    };
  });

  const subtotal = sumPiasters(...lines.map((l) => l.lineTotal));
  const shipping = computeShipping(subtotal);
  const total = sumPiasters(subtotal, shipping);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  return {
    token,
    lines,
    itemCount,
    subtotal,
    shipping,
    total,
    freeShippingRemaining: freeShippingRemaining(subtotal),
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD_PIASTERS,
  };
}

/** Shipping fee: waived once subtotal meets the threshold, else the flat fee. */
function computeShipping(subtotal: Piasters): Piasters {
  if (subtotal >= env.FREE_SHIPPING_THRESHOLD_PIASTERS) return 0 as Piasters;
  return env.SHIPPING_FEE_PIASTERS;
}

/** Remaining spend to reach free shipping (0 if already qualified). */
function freeShippingRemaining(subtotal: Piasters): Piasters {
  const remaining = env.FREE_SHIPPING_THRESHOLD_PIASTERS - subtotal;
  return (remaining > 0 ? remaining : 0) as Piasters;
}
