"use client";

import { useState } from "react";
import { updatePrice, updateStock, togglePublish } from "@/lib/admin/actions";
import { cn } from "@/lib/cn";

/**
 * Editable products table. Stock + price edits call server actions; each cell
 * shows a transient saved state. Low-stock variants are flagged.
 */
type Variant = { id: string; colorway: string; size: string; sku: string; stock: number; reserved: number; available: number; price: number; lowStock: boolean };
type Product = { id: string; slug: string; name: string; collection: string; published: boolean; featured: boolean; totalStock: number; variants: Variant[] };

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <div className="space-y-8">
      {products.map((p) => (
        <ProductRow key={p.id} product={p} />
      ))}
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [published, setPublished] = useState(product.published);
  const [savingPub, setSavingPub] = useState(false);

  async function onPublish() {
    setSavingPub(true);
    const next = !published;
    setPublished(next);
    await togglePublish({ productId: product.id, published: next });
    setSavingPub(false);
  }

  return (
    <section className="border border-line">
      <header className="flex items-center justify-between border-b border-line bg-ivory-deep px-4 py-3">
        <div>
          <h2 className="font-medium">{product.name}</h2>
          <p className="text-meta">{product.collection} · {product.totalStock} in stock</p>
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={savingPub}
          className={cn(
            "border px-3 py-1 text-xs uppercase tracking-wider",
            published ? "border-ink text-ink" : "border-line text-ink-soft",
          )}
        >
          {published ? "Published" : "Hidden"}
        </button>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-meta border-b border-line">
            <th className="px-4 py-2">Colour · Size</th>
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">Stock</th>
            <th className="px-4 py-2">Reserved</th>
            <th className="px-4 py-2">Available</th>
            <th className="px-4 py-2">Price (EGP)</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <VariantRow key={v.id} variant={v} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function VariantRow({ variant }: { variant: Variant }) {
  const [stock, setStock] = useState(String(variant.stock));
  const [price, setPrice] = useState(String(variant.price / 100));
  const [savingStock, setSavingStock] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [savedStock, setSavedStock] = useState(false);
  const [savedPrice, setSavedPrice] = useState(false);

  async function saveStock() {
    setSavingStock(true);
    await updateStock({ variantId: variant.id, stock: Number(stock) });
    setSavingStock(false);
    setSavedStock(true);
    setTimeout(() => setSavedStock(false), 1500);
  }
  async function savePrice() {
    setSavingPrice(true);
    // convert displayed EGP to piasters
    await updatePrice({ variantId: variant.id, unitAmount: Math.round(Number(price) * 100) });
    setSavingPrice(false);
    setSavedPrice(true);
    setTimeout(() => setSavedPrice(false), 1500);
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2">
        {variant.colorway} · {variant.size}
        {variant.lowStock && variant.available > 0 && (
          <span className="ms-2 text-xs text-gold">low</span>
        )}
        {variant.available === 0 && (
          <span className="ms-2 text-xs text-error">out</span>
        )}
      </td>
      <td className="px-4 py-2 text-ink-soft">{variant.sku}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-8 w-16 border border-line px-2"
            min={0}
          />
          <button type="button" onClick={saveStock} disabled={savingStock} className="text-xs text-ink-soft hover:text-ink">
            {savedStock ? "✓" : "save"}
          </button>
        </div>
      </td>
      <td className="px-4 py-2 text-ink-soft">{variant.reserved}</td>
      <td className="px-4 py-2">{variant.available}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-8 w-20 border border-line px-2"
            min={0}
          />
          <button type="button" onClick={savePrice} disabled={savingPrice} className="text-xs text-ink-soft hover:text-ink">
            {savedPrice ? "✓" : "save"}
          </button>
        </div>
      </td>
    </tr>
  );
}
