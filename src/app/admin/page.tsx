import Link from "next/link";
import { adminDashboardStats } from "@/lib/admin/queries";

/** /admin — dashboard summary. */
export default async function AdminDashboard() {
  const stats = await adminDashboardStats();
  return (
    <div>
      <h1 className="font-display text-3xl lowercase mb-6">dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Products" value={stats.productCount} href="/admin/products" />
        <Stat label="Variants" value={stats.variantCount} href="/admin/products" />
        <Stat label="Orders" value={stats.orderCount} href="/admin/orders" />
        <Stat label="Low stock" value={stats.lowStockVariants} href="/admin/products" tone={stats.lowStockVariants > 0 ? "warn" : "ok"} />
      </div>
      <p className="mt-8 text-sm text-ink-soft">
        Manage the catalog, adjust stock, and progress orders through fulfilment.
      </p>
    </div>
  );
}

function Stat({ label, value, href, tone = "ok" }: { label: string; value: number; href: string; tone?: "ok" | "warn" }) {
  return (
    <Link href={href} className="block border border-line bg-ivory-deep p-4 hover:border-ink-soft">
      <p className="text-meta">{label}</p>
      <p className={`mt-2 font-display text-3xl ${tone === "warn" ? "text-gold" : "text-ink"}`}>{value}</p>
    </Link>
  );
}
