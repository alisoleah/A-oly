import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Token config snapshot (TESTING_GUIDE.md §1).
 * The palette is brand-defining and must not drift accidentally.
 * This is a config snapshot, not visual styling minutiae (which we don't over-test).
 */
const globalsCss = readFileSync(
  path.resolve(import.meta.dirname, "../../src/app/globals.css"),
  "utf8",
);

describe("design tokens — globals.css", () => {
  it("defines exactly the brand palette with the canonical hex values", () => {
    // Aligned to the aïoly brand identity (aioly-brand.html).
    const palette: Record<string, string> = {
      ivory: "#f7f4ee",
      "ivory-deep": "#efe9df",
      ink: "#1a1a18",
      "ink-soft": "#4a4a46",
      gold: "#b8926a",
      "gold-soft": "#cdb088",
      blush: "#e8d5c4",
      slate: "#7a7a76",
      line: "#d9d2c5",
      error: "#8c3b2e",
      success: "#5a6b4f",
    };
    for (const [name, hex] of Object.entries(palette)) {
      expect(globalsCss.toLowerCase()).toContain(`--color-${name}: ${hex}`);
    }
  });

  it("never allows pure white or pure black (design-system.md §1)", () => {
    // Pure #fff/#000 anywhere in the palette would break the brand rule.
    // (We can't ban them from every util, but we can ban them as tokens.)
    expect(globalsCss).not.toMatch(/--color-[^:]+:\s*#fff\b/i);
    expect(globalsCss).not.toMatch(/--color-[^:]+:\s*#000\b/i);
  });

  it("exposes gold as the single accent — one per view rule documented", () => {
    expect(globalsCss).toMatch(/THE accent|one use per view/i);
  });

  it("wires the two brand fonts via CSS variables", () => {
    expect(globalsCss).toContain("--font-display");
    expect(globalsCss).toContain("--font-body");
    expect(globalsCss).toContain("cormorant");
    expect(globalsCss).toContain("inter");
  });

  it("keeps sharp edges as the default radius", () => {
    expect(globalsCss).toMatch(/--radius-none:\s*0/);
    expect(globalsCss).toMatch(/--radius-pill:\s*999px/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(globalsCss).toMatch(/prefers-reduced-motion:\s*reduce/i);
  });

  it("uses CSS logical properties (RTL-ready) in the container", () => {
    // Logical props travel with writing direction — required for Arabic later.
    expect(globalsCss).toContain("margin-inline");
    expect(globalsCss).toContain("padding-inline");
    expect(globalsCss).toContain("padding-block");
  });

  it("keeps a visible 2px ink focus outline (a11y §8)", () => {
    expect(globalsCss).toMatch(/:focus-visible/);
    expect(globalsCss.toLowerCase()).toContain("2px solid var(--color-ink)");
  });
});
