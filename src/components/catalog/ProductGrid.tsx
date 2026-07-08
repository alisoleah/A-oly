"use client";

import { useMemo, useState } from "react";
import type { ProductCardVM, Size } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { StaggerGrid, StaggerItem } from "@/components/ui/StaggerGrid";
import {
  FilterSidebar,
  EMPTY_FILTERS,
  type FilterState,
  type Facets,
} from "@/components/catalog/FilterSidebar";
import { SortSelect, type SortKey } from "@/components/catalog/SortSelect";
import { messages } from "@/i18n/messages";

/**
 * ProductGrid — the interactive listing surface.
 *
 * Receives ALL products for a collection (already fetched server-side), then
 * does filtering + sorting client-side. For a small curated catalog this is
 * instant and keeps the page a pure server component; we'd move filtering
 * server-side only if the catalog grew into the hundreds.
 *
 * Layout: filter rail (left, desktop) + main column (sort bar + card grid).
 */
export function ProductGrid({ products }: { products: ProductCardVM[] }) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("featured");

  // Derive the available facets once from the full product set.
  const facets: Facets = useMemo(() => {
    const sizes = new Set<Size>();
    const colourMap = new Map<string, string>();
    for (const p of products) {
      for (const s of p.sizes) sizes.add(s);
      for (const c of p.colorways) colourMap.set(c.name, c.hex);
    }
    return {
      sizes: Array.from(sizes),
      colours: Array.from(colourMap, ([name, hex]) => ({ name, hex })),
    };
  }, [products]);

  // Apply filters + sort.
  const visible = useMemo(() => {
    let out = products;

    if (filters.sizes.length > 0) {
      out = out.filter((p) => p.sizes.some((s) => filters.sizes.includes(s)));
    }
    if (filters.colours.length > 0) {
      out = out.filter((p) =>
        p.colorways.some((c) => filters.colours.includes(c.name)),
      );
    }

    const sorted = [...out];
    switch (sort) {
      case "priceAsc":
        sorted.sort((a, b) => a.priceFrom - b.priceFrom);
        break;
      case "priceDesc":
        sorted.sort((a, b) => b.priceFrom - a.priceFrom);
        break;
      case "nameAsc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "featured":
      default:
        // featured first, then name — matches listProducts() server order
        sorted.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        break;
    }
    return sorted;
  }, [products, filters, sort]);

  return (
    <div className="flex gap-10">
      <FilterSidebar
        facets={facets}
        filters={filters}
        onChange={setFilters}
        resultCount={visible.length}
      />

      <div className="min-w-0 flex-1">
        {/* Sort bar */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="hidden text-meta text-ink-soft md:block">
            {messages.catalog.showing
              .replace("{count}", String(visible.length))
              .replace("{count, plural, one {piece} other {pieces}}", visible.length === 1 ? "piece" : "pieces")}
          </p>
          <div className="ms-auto">
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-2xl lowercase text-ink">
              {messages.catalog.noResults}
            </p>
            <p className="mt-2 text-sm text-ink-soft">{messages.catalog.adjustFilters}</p>
          </div>
        ) : (
          <StaggerGrid className="grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8">
            {visible.map((p) => (
              <StaggerItem key={p.id}>
                <ProductCard product={p} />
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </div>
    </div>
  );
}
