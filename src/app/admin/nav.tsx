"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
];

/** Sidebar nav; highlights the active section. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="md:sticky md:top-20 md:self-start">
      <ul className="flex gap-4 md:flex-col md:gap-1">
        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block py-1 text-sm transition-colors",
                  active ? "text-ink font-medium" : "text-ink-soft hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
