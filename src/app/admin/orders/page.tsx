import Link from "next/link";
import { listAdminOrders } from "@/lib/admin/queries";

/** /admin/orders — order list, newest first. */
export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl lowercase">orders</h1>
        {/* Native <a> is intentional: this is a file-download endpoint, not a
            page navigation. <Link> would attempt client-side routing on a
            blob/CSV response, which is wrong. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/admin/orders/export" download className="text-meta text-ink-soft hover:text-ink">
          Export CSV
        </a>
      </div>
      {orders.length === 0 ? (
        <p className="text-ink-soft py-8">No orders yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-meta border-b border-line">
              <th className="py-2">Order</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Status</th>
              <th className="py-2">Payment</th>
              <th className="py-2">Items</th>
              <th className="py-2">Total</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-ivory-deep">
                <td className="py-2"><Link href={`/admin/orders/${o.id}`} className="text-ink underline">{o.number}</Link></td>
                <td className="py-2 text-ink-soft">{o.email}</td>
                <td className="py-2"><StatusBadge status={o.status} /></td>
                <td className="py-2 text-ink-soft">{o.paymentMethod}</td>
                <td className="py-2 text-ink-soft">{o.itemCount}</td>
                <td className="py-2 text-price">{o.totalDisplay}</td>
                <td className="py-2 text-ink-soft">{o.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PAID" || status === "DELIVERED" ? "text-success" :
    status === "CANCELLED" || status === "REFUNDED" ? "text-error" :
    status === "PENDING_PAYMENT" || status === "PENDING_COD" ? "text-gold" : "text-ink";
  return <span className={`text-xs uppercase tracking-wider ${tone}`}>{status}</span>;
}
