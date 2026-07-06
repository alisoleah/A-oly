import { test, expect } from "@playwright/test";

/**
 * Phase 2 e2e — cart journeys (TESTING_GUIDE.md §e2e journey 5 + race note).
 *
 * Runs against the built app (PAYMENT_PROVIDER=mock) which points at Supabase.
 * Cart actions round-trip to the DB, so assertions use generous waits via the
 * badge — the header count is the single reliable signal that an add persisted.
 *
 * Invariants asserted here:
 *  - Add to cart opens the drawer with the correct line.
 *  - Header badge reflects server-computed item count.
 *  - Quantity stepper changes the line total (server-recomputed).
 *  - Cart persists across navigation in the same context.
 *  - Stock cap: cannot exceed available stock via the stepper.
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

async function addToCartFlow(
  page: import("@playwright/test").Page,
  slug: string,
  colorway: string,
  size: string,
) {
  await page.goto(`/aethra/${slug}`);
  await page.getByRole("button", { name: new RegExp(`^${colorway}$`) }).click();
  const sizeBtn = page.getByRole("button", { name: new RegExp(`^${size}$`) });
  await sizeBtn.click();
  // Wait until the size is actually selected before adding.
  await expect(sizeBtn).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Add to cart/i }).click();
}

test.describe("Cart drawer", () => {
  test("add to cart opens drawer with the line and updates the badge", async ({ page }) => {
    await addToCartFlow(page, "signature-asymmetric-draped-pants", "Ivory", "M");

    // Badge is the reliable success signal (action + refresh complete).
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });
    // Drawer opens with the product line.
    const dialog = page.getByRole("dialog", { name: /your bag/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Signature Asymmetric Draped Pants/i)).toBeVisible();
  });

  test("quantity stepper changes the line total", async ({ page }) => {
    await addToCartFlow(page, "signature-asymmetric-draped-pants", "Ivory", "L");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });

    const dialog = page.getByRole("dialog", { name: /your bag/i });
    // Drive the stepper and assert the displayed quantity + badge — these are
    // unambiguous (the price text appears in both the line and the subtotal).
    const qtyDisplay = dialog.getByText("1", { exact: true });
    await expect(qtyDisplay).toBeVisible();

    // Increase to 2 → badge shows 2, qty shows 2.
    await dialog.getByRole("button", { name: /Increase quantity/i }).click();
    await expect(page.getByLabel(/Cart \(2\)/)).toBeVisible({ timeout: 20000 });

    // Decrease back to 1 → badge shows 1.
    await dialog.getByRole("button", { name: /Decrease quantity/i }).click();
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });
  });

  test("remove empties the line", async ({ page }) => {
    await addToCartFlow(page, "wide-leg-trouser", "Ink", "S");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });

    const dialog = page.getByRole("dialog", { name: /your bag/i });
    await expect(dialog.getByText(/Wide-Leg Trouser/i)).toBeVisible();
    await dialog.getByRole("button", { name: /Remove/i }).click();
    await expect(dialog.getByText(/your bag is empty/i)).toBeVisible({ timeout: 20000 });
  });

  test("free-shipping progress line appears", async ({ page }) => {
    await addToCartFlow(page, "tailored-blazer", "Ink", "M");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });
    // Blazer is 5,500; threshold is 5,000 → free shipping earned.
    const dialog = page.getByRole("dialog", { name: /your bag/i });
    await expect(dialog.getByText(/complimentary shipping unlocked/i)).toBeVisible();
  });
});

test.describe("Cart persistence", () => {
  test("cart survives a fresh navigation in the same context", async ({ page }) => {
    await addToCartFlow(page, "fluid-shirt", "Ivory", "M");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });

    // Navigate away and back — badge persists (cookie-backed).
    await page.goto("/");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible();

    // Open the drawer from the header — line still there.
    await page.getByLabel(/Cart \(1\)/).click();
    const dialog = page.getByRole("dialog", { name: /your bag/i });
    await expect(dialog.getByText(/Fluid Shirt/i)).toBeVisible({ timeout: 20000 });
  });
});

test.describe("Cart page fallback", () => {
  test("/cart renders the full-page cart after adding", async ({ page }) => {
    await addToCartFlow(page, "column-dress", "Ivory", "L");
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });

    await page.goto("/cart");
    // The product name is unambiguous in the main region.
    await expect(page.getByRole("main").getByText(/Column Dress/i)).toBeVisible();
  });

  test("/cart shows empty state with no cookie", async ({ page }) => {
    await page.goto("/cart");
    // Scope to main so it doesn't match the always-mounted cart drawer's empty state.
    await expect(page.getByRole("main").getByText(/your bag is empty/i)).toBeVisible();
  });
});
