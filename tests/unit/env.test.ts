import { describe, expect, it } from "vitest";
import {
  envSchema,
  isCodEnabledForCountry,
  parseEnv,
  productionPreflight,
  withInvariants,
  type Env,
} from "@/lib/env";

/**
 * Env validation tests (TESTING_GUIDE.md §1: "env validation rejects bad env").
 * The app must fail closed on misconfiguration rather than break mid-checkout.
 */

const GOOD: Record<string, string> = {
  DATABASE_URL: "file:./test.db",
  NODE_ENV: "test",
  ADMIN_EMAIL: "founder@aioly.eg",
  ADMIN_PASSWORD_HASH: "$2a$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ",
  SESSION_SECRET: "x".repeat(40),
  PAYMENT_PROVIDER: "mock",
};

function parse(source: Record<string, string>): Env {
  return withInvariants(parseEnv(source));
}

describe("env validation — happy path", () => {
  it("parses a valid environment and applies defaults", () => {
    const e = parse(GOOD);
    expect(e.PAYMENT_PROVIDER).toBe("mock");
    expect(e.PAYMOB_CENTS_FACTOR).toBe(100);
    expect(e.SHIPPING_FEE_PIASTERS).toBe(6000);
    expect(e.FREE_SHIPPING_THRESHOLD_PIASTERS).toBe(500000);
    expect(e.RESERVATION_TTL_MINUTES).toBe(30);
  });

  it("coerces numeric env strings to integers", () => {
    const e = parse({ ...GOOD, SHIPPING_FEE_PIASTERS: "12000" });
    expect(e.SHIPPING_FEE_PIASTERS).toBe(12000);
    expect(typeof e.SHIPPING_FEE_PIASTERS).toBe("number");
  });

  it("splits, trims, and uppercases the COD country list", () => {
    const e = parse({ ...GOOD, COD_ENABLED_COUNTRIES: "eg, sa" });
    expect(e.COD_ENABLED_COUNTRIES).toEqual(["EG", "SA"]);
  });

  it("isCodEnabledForCountry is case-insensitive", () => {
    parse(GOOD); // sets module-level env from process.env at import; test the helper directly
    expect(isCodEnabledForCountry("eg")).toBe(true);
    expect(isCodEnabledForCountry("EG")).toBe(true);
    expect(isCodEnabledForCountry("us")).toBe(false);
  });
});

describe("env validation — rejection (fail closed)", () => {
  it("rejects a missing DATABASE_URL", () => {
    expect(() => parse({ ...GOOD, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("rejects an invalid admin email", () => {
    expect(() => parse({ ...GOOD, ADMIN_EMAIL: "not-an-email" })).toThrow(
      /ADMIN_EMAIL/,
    );
  });

  it("rejects a too-short password hash", () => {
    expect(() => parse({ ...GOOD, ADMIN_PASSWORD_HASH: "short" })).toThrow(
      /ADMIN_PASSWORD_HASH/,
    );
  });

  it("rejects a too-short session secret", () => {
    expect(() => parse({ ...GOOD, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("rejects an unknown payment provider", () => {
    expect(() => parse({ ...GOOD, PAYMENT_PROVIDER: "stripe" })).toThrow(
      /PAYMENT_PROVIDER/,
    );
  });

  it("rejects an invalid NODE_ENV", () => {
    expect(() => parse({ ...GOOD, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("rejects a negative shipping fee", () => {
    expect(() => parse({ ...GOOD, SHIPPING_FEE_PIASTERS: "-5" })).toThrow();
  });
});

describe("env invariants — provider gating", () => {
  it("paymob provider requires all Paymob keys", () => {
    expect(() =>
      parse({ ...GOOD, PAYMENT_PROVIDER: "paymob" }),
    ).toThrow(/PAYMOB_API_KEY/);
  });

  it("paymob provider accepts when all keys are present", () => {
    const e = parse({
      ...GOOD,
      PAYMENT_PROVIDER: "paymob",
      PAYMOB_API_KEY: "k",
      PAYMOB_HMAC_SECRET: "h",
      PAYMOB_INTEGRATION_ID: "1",
      PAYMOB_IFRAME_ID: "2",
    });
    expect(e.PAYMENT_PROVIDER).toBe("paymob");
  });

  it("resend email provider requires RESEND_API_KEY", () => {
    expect(() => parse({ ...GOOD, EMAIL_PROVIDER: "resend" })).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it("console email provider is disallowed in production (preflight, not module load)", () => {
    // Policy checks run at deploy time, not module load (next build runs server
    // code with NODE_ENV=production; a local gate-check build must still pass).
    const e = parse({ ...GOOD, NODE_ENV: "production", EMAIL_PROVIDER: "console" });
    const problems = productionPreflight(e);
    expect(problems.some((p) => /console/.test(p))).toBe(true);
  });
});

describe("production preflight", () => {
  it("flags mock provider as non-production", () => {
    const e = parse(GOOD);
    const problems = productionPreflight(e);
    expect(problems.some((p) => /PAYMENT_PROVIDER/.test(p))).toBe(true);
  });

  it("passes when paymob + keys + resend are configured", () => {
    const e = parse({
      ...GOOD,
      PAYMENT_PROVIDER: "paymob",
      PAYMOB_API_KEY: "k",
      PAYMOB_HMAC_SECRET: "h",
      PAYMOB_INTEGRATION_ID: "1",
      PAYMOB_IFRAME_ID: "2",
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_x",
    });
    expect(productionPreflight(e)).toEqual([]);
  });
});

describe("env schema shape", () => {
  it("keeps money fields as integers, not floats, after coercion", () => {
    const e = parse({ ...GOOD, SHIPPING_FEE_PIASTERS: "6000.0" });
    expect(Number.isInteger(e.SHIPPING_FEE_PIASTERS)).toBe(true);
  });

  it("exposes APP_BASE_URL with a url default", () => {
    const e = parse({ ...GOOD });
    expect(() => new URL(e.APP_BASE_URL)).not.toThrow();
  });

  it("schema is importable and parseable directly", () => {
    expect(() => envSchema.parse(GOOD)).not.toThrow();
  });
});
