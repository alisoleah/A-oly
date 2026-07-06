import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/orders/status?token=<confirmToken>
 *
 * Returns ONLY the order status — read-only, used by the "confirming payment"
 * polling page. The token is unguessable (256-bit confirmToken), so this reveals
 * status only to whoever has the confirmation link.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { confirmToken: token },
    select: { status: true },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ status: order.status });
}
