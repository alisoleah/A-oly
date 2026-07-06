import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // Unit tests use a harmless SQLite override (they never hit the DB);
    // integration tests run against the real Supabase DB (load .env).
    setupFiles: ["./tests/setup.ts"],
    // Integration tests hit Supabase over the network; allow generous time.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
