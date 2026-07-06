/**
 * Generates 4:5 placeholder product images in the brand palette.
 * These stand in for real photography until the lookbook is shot.
 * Two shots per colorway (primary + hover-swap per design-system.md §5).
 *
 * Output: /public/images/products/<slug>-<colorway>-<n>.svg
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "images", "products");

type Colorway = { name: string; hex: string; ink: string };

const PALETTE: Record<string, Colorway> = {
  Ivory: { name: "Ivory", hex: "#EDE7DC", ink: "#1A1A1A" },
  Ink: { name: "Ink", hex: "#1A1A1A", ink: "#F5F1EA" },
  Sand: { name: "Sand", hex: "#C4A67F", ink: "#1A1A1A" },
};

type Product = {
  slug: string;
  name: string;
  colorways: string[];
};

const PRODUCTS: Product[] = [
  { slug: "signature-asymmetric-draped-pants", name: "Signature Asymmetric Draped Pants", colorways: ["Ivory", "Ink"] },
  { slug: "wide-leg-trouser", name: "Wide-Leg Trouser", colorways: ["Ivory", "Ink"] },
  { slug: "tailored-blazer", name: "Tailored Blazer", colorways: ["Ink", "Sand"] },
  { slug: "fluid-shirt", name: "Fluid Shirt", colorways: ["Ivory", "Ink"] },
  { slug: "column-dress", name: "Column Dress", colorways: ["Ivory", "Ink"] },
];

// 4:5 portrait = 800×1000
function svg(slug: string, name: string, cw: Colorway, variant: number): string {
  const label = `${name} — ${cw.name}`;
  // variant 1 = full garment silhouette; variant 2 = detail/fabric (hover swap)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="${label}">
  <rect width="800" height="1000" fill="${cw.hex}"/>
  <rect x="0" y="0" width="800" height="1000" fill="#F5F1EA" opacity="${variant === 1 ? 0 : 0.15}"/>
  <!-- garment silhouette placeholder -->
  <g fill="none" stroke="${cw.ink}" stroke-width="1.5" opacity="0.55">
    ${variant === 1
      ? `<path d="M300 220 L500 220 L520 800 L280 800 Z"/>
         <line x1="400" y1="220" x2="400" y2="800"/>`
      : `<circle cx="400" cy="450" r="160"/>
         <line x1="260" y1="600" x2="540" y2="300"/>`}
  </g>
  <text x="400" y="900" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${cw.ink}" opacity="0.7" letter-spacing="2">${slug.toUpperCase().split("-").slice(0,2).join(" ")}</text>
  <text x="400" y="940" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="${cw.ink}" opacity="0.5" letter-spacing="3">${cw.name.toUpperCase()} · ${variant === 1 ? "FRONT" : "DETAIL"}</text>
</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let count = 0;
  for (const p of PRODUCTS) {
    for (const cwName of p.colorways) {
      const cw = PALETTE[cwName];
      if (!cw) throw new Error(`unknown colorway ${cwName}`);
      for (const variant of [1, 2]) {
        const file = path.join(OUT, `${p.slug}-${cwName.toLowerCase()}-${variant}.svg`);
        await writeFile(file, svg(p.slug, p.name, cw, variant), "utf8");
        count++;
      }
    }
  }
  console.log(`✓ wrote ${count} placeholder images to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
