import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

/**
 * Cart cookie + token helpers.
 *
 * CLAUDE.md: "server-persisted cart (cookie-keyed for guests)". The cookie holds
 * an UNGUESSABLE token that maps to a Cart row in the DB. The cart's contents
 * live in the database — never trust client-sent cart state.
 *
 * Cookie attributes (security baseline): httpOnly (no JS access), sameSite=lax,
 * Secure in production, a 90-day expiry. The token is 32 bytes of entropy
 * (256 bits) — far beyond brute-forceable.
 */

export const CART_COOKIE = "aioly_cart";
const CART_MAX_AGE_DAYS = 90;
const TOKEN_BYTES = 32;

/** Generate a fresh, unguessable cart token (256-bit). */
export function generateCartToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** Read the existing cart token from the request cookies, if any. */
export async function getCartToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value;
}

/**
 * Persist a cart token to the response cookies.
 * ⚠️ Only callable from a Server Action or Route Handler — NOT from a Server
 * Component (Next.js forbids cookie writes in RSC). Use ensureCartToken() in
 * actions/handlers where mutation is allowed; use readCartToken() in RSC.
 */
export async function setCartCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * CART_MAX_AGE_DAYS,
  });
}

/** Clear the cart cookie (used if a cart is explicitly abandoned/merged later). */
export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
