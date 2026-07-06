import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config — runs against a seeded dev server with PAYMENT_PROVIDER=mock.
 * CI order per TESTING_GUIDE.md: typecheck → lint → vitest → build → playwright.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shared test DB — serialize e2e
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Cart actions round-trip to Supabase; allow generous assertion time.
    actionTimeout: 20_000,
  },
  expect: {
    // Supabase network latency can push add-to-cart beyond the default 5s.
    timeout: 20_000,
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14"] },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: "npm run build && PAYMENT_PROVIDER=mock npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
