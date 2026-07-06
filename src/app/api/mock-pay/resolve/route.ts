import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * /api/mock-pay/resolve — maps a mock payment ref (mock_<orderId>) back to the
 * order so the mock pay page knows the amount + confirm token. Dev/test only.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref") ?? "";
  // ref is "mock_<orderId>"
  const orderId = ref.replace(/^mock_/, "");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, total: true, confirmToken: true },
  });
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    orderNumber: order.number,
    amount: order.total,
    confirmToken: order.confirmToken,
  });
}
