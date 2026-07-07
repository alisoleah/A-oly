import { listAdminProducts } from "@/lib/admin/queries";
import { ProductsTable } from "@/app/admin/products/table";

/** /admin/products — catalog with editable stock + price. */
export default async function AdminProductsPage() {
  const products = await listAdminProducts();
  return (
    <div>
      <h1 className="font-display text-3xl lowercase mb-6">products</h1>
      <ProductsTable products={products} />
    </div>
  );
}
