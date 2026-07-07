import { prisma } from "@/lib/prisma";
import { availableStock } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

/**
 * Admin data-access — read queries for the admin dashboard.
 * (Mutations live in actions.ts; this file is read-only.)
 *
 * Everything here runs behind the middleware auth gate. Returns shaped
 * view-models so the admin pages never touch raw Prisma rows.
 */

const LOW_STOCK_THRESHOLD = 3;

/** Products with their variants + current prices for the products table. */
export async function listAdminProducts() {
  const products = await prisma.product.findMany({
    orderBy: [{ collection: "asc" }, { name: "asc" }],
    include: {
      variants: {
        orderBy: [{ colorway: "asc" }, { size: "asc" }],
        include: { prices: { where: { currency: "EGP" } } },
      },
    },
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    collection: p.collection,
    published: p.published,
    featured: p.featured,
    totalStock: p.variants.reduce((n, v) => n + availableStock(v.stock, v.reserved), 0),
    variants: p.variants.map((v) => ({
      id: v.id,
      colorway: v.colorway,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
      reserved: v.reserved,
      available: availableStock(v.stock, v.reserved),
      price: v.prices[0]?.unitAmount ?? 0,
      lowStock: availableStock(v.stock, v.reserved) <= LOW_STOCK_THRESHOLD,
    })),
  }));
}

/** Orders for the admin list, newest first. */
export async function listAdminOrders(limit = 100) {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      email: true,
      status: true,
      paymentMethod: true,
      total: true,
      currency: true,
      createdAt: true,
      items: { select: { qty: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    email: o.email,
    status: o.status,
    paymentMethod: o.paymentMethod,
    total: o.total,
    totalDisplay: formatPrice(o.total),
    createdAt: o.createdAt,
    itemCount: o.items.reduce((n, i) => n + i.qty, 0),
  }));
}

/** One order's full detail for the order-detail page. */
export async function getAdminOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          nameSnapshot: true,
          colorwaySnapshot: true,
          sizeSnapshot: true,
          unitAmountSnapshot: true,
          qty: true,
        },
      },
      paymentEvents: { orderBy: { processedAt: "desc" } },
    },
  });
  if (!order) return null;
  return {
    ...order,
    shippingAddress: JSON.parse(order.shippingAddress) as {
      fullName: string; governorate: string; city: string;
      addressLine1: string; addressLine2: string; postalCode: string;
      country: string; notes: string;
    },
    totalDisplay: formatPrice(order.total),
    items: order.items.map((i) => ({
      ...i,
      lineTotalDisplay: formatPrice(i.unitAmountSnapshot * i.qty),
    })),
  };
}

/** Counts for the dashboard summary. */
export async function adminDashboardStats() {
  const [productCount, variantCount, orderCount, lowStockVariants] = await Promise.all([
    prisma.product.count(),
    prisma.variant.count(),
    prisma.order.count(),
    prisma.variant.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD } } }),
  ]);
  return { productCount, variantCount, orderCount, lowStockVariants };
}
