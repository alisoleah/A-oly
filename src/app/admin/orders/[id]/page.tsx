import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrder } from "@/lib/admin/queries";
import { OrderActions } from "@/app/admin/orders/[id]/actions";

/** /admin/orders/[id] — order detail with status transitions. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const addr = order.shippingAddress;

  return (
    <div>
      <Link href="/admin/orders" className="text-meta text-ink-soft hover:text-ink">← Orders</Link>
      <h1 className="font-display text-3xl lowercase mt-2 mb-1">{order.number}</h1>
      <p className="text-meta mb-6">{order.status} · {order.paymentMethod}</p>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_280px]">
        <div>
          <h2 className="text-meta mb-3">Items</h2>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between py-3 text-sm">
                <span>
                  {item.nameSnapshot} × {item.qty}
                  <span className="block text-xs text-ink-soft">{item.colorwaySnapshot} · {item.sizeSnapshot}</span>
                </span>
                <span className="text-price">{item.lineTotalDisplay}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between text-base">
            <span>Total</span>
            <span className="text-price">{order.totalDisplay}</span>
          </div>

          <h2 className="text-meta mt-8 mb-3">Payment events</h2>
          <ul className="text-xs text-ink-soft space-y-1">
            {order.paymentEvents.map((e) => (
              <li key={e.id}>{e.type} · {e.provider} · {new Date(e.processedAt).toLocaleString()}</li>
            ))}
            {order.paymentEvents.length === 0 && <li>None recorded.</li>}
          </ul>
        </div>

        <aside className="space-y-6">
          <div className="border border-line p-4">
            <h2 className="text-meta mb-2">Customer</h2>
            <p className="text-sm">{addr.fullName}</p>
            <p className="text-sm text-ink-soft">{order.email}</p>
          </div>
          <div className="border border-line p-4">
            <h2 className="text-meta mb-2">Ship to</h2>
            <p className="text-sm">{addr.addressLine1}</p>
            {addr.addressLine2 && <p className="text-sm">{addr.addressLine2}</p>}
            <p className="text-sm">{addr.city}, {addr.governorate}</p>
            <p className="text-sm text-ink-soft">{addr.country}</p>
            {addr.notes && <p className="mt-2 text-xs text-ink-soft">Note: {addr.notes}</p>}
          </div>
          <OrderActions orderId={order.id} status={order.status} />
          {order.trackingNumber && (
            <p className="text-xs text-ink-soft">Tracking: {order.trackingNumber}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
