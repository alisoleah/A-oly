import { NextResponse } from "next/server";
import { ensureCartToken, loadCart } from "@/lib/cart/repository";

/**
 * GET /api/cart — returns the server-computed cart view-model for the caller's
 * cookie token. This is the single read path the client CartProvider uses.
 *
 * Route Handler → cookie mutation is allowed here, so we ensure a token exists.
 * Totals are always recomputed here on the server.
 */
export async function GET() {
  const token = await ensureCartToken();
  const cart = await loadCart(token);
  return NextResponse.json(cart);
}
