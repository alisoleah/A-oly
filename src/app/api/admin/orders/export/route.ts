import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toMajor } from "@/lib/money";

/**
 * GET /api/admin/orders/export — CSV of all orders (behind the admin auth gate).
 * Columns: number, status, payment method, email, total (EGP), currency, items, created.
 */
function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      number: true, status: true, paymentMethod: true, email: true,
      total: true, currency: true, createdAt: true,
      items: { select: { qty: true } },
    },
  });

  const header = ["order", "status", "payment", "email", "total_egp", "currency", "items", "created"];
  const rows = orders.map((o) => [
    o.number,
    o.status,
    o.paymentMethod,
    o.email,
    toMajor(o.total),
    o.currency,
    o.items.reduce((n, i) => n + i.qty, 0),
    o.createdAt.toISOString(),
  ].map(csvEscape).join(","));

  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aioly-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
