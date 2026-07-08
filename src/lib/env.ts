import { z } from "zod";

/**
 * Environment validation — the single source of truth for config.
 * Every external value (env vars, API input, webhooks) is validated with Zod;
 * this module validates at boot so the app fails closed on misconfiguration
 * instead of breaking mid-checkout. (CLAUDE.md §Stack, security baseline.)
 *
 * Secrets are NEVER exposed to the client. Only vars explicitly prefixed with
 * NEXT_PUBLIC_ reach the browser bundle; this file does not use that prefix.
 */

const envSchema = z.object({
  /** Database connection. SQLite file in dev, postgres URL in prod. */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Admin auth — single credential (CLAUDE.md §Auth). */
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z
    .string()
    .min(20, "ADMIN_PASSWORD_HASH must be a bcrypt hash (run scripts/hash-password.ts)"),

  /** Session cookie signing. ≥32 bytes of entropy. */
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  /** Payment provider selection. mock = dev/test, paymob = prod. */
  PAYMENT_PROVIDER: z.enum(["mock", "paymob"]).default("mock"),

  /** Paymob Intention API / unified checkout credentials. */
  PAYMOB_API_KEY: z.string().optional(),
  PAYMOB_HMAC_SECRET: z.string().optional(),
  PAYMOB_INTEGRATION_ID: z.string().optional(),
  PAYMOB_IFRAME_ID: z.string().optional(),
  /** EGP minor units per major unit. Paymob EGP uses 100 cents = 1 EGP. */
  PAYMOB_CENTS_FACTOR: z.coerce.number().int().positive().default(100),

  /** Reservation TTL — minutes an online-payment order holds stock. */
  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  /** Shipping config in integer piasters (EGP × 100). */
  SHIPPING_FEE_PIASTERS: z.coerce.number().int().nonnegative().default(6000),
  FREE_SHIPPING_THRESHOLD_PIASTERS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(500000),

  /** COD availability per shipping country (ISO-3166 alpha-2). */
  COD_ENABLED_COUNTRIES: z
    .string()
    .default("EG")
    .transform((s) => s.split(",").map((c) => c.trim().toUpperCase())),

  /** Email provider: console (dev) | resend (prod). */
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  /** Analytics — GA4 measurement ID (G-XXXX) and/or Meta Pixel ID. Optional. */
  NEXT_PUBLIC_GA4_ID: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),

  /** Storefront base URL for OG images, return URLs, email links. */
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse a raw env record against the schema. Exported so tests can feed
 * controlled fixtures without mutating process.env. Throws on any failure
 * with a field-by-field breakdown so misconfiguration is obvious at boot.
 */
export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Fail closed — never boot with invalid config.
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCheck your .env file against .env.example.`,
    );
  }
  return parsed.data;
}

export { envSchema };

/**
 * Cross-provider invariants enforced at module load so checkout code stays clean.
 * These are *correctness* checks — values that would cause a runtime crash —
 * NOT policy checks. They fire only on explicit misconfiguration that never
 * occurs in a normal dev (`mock`) or prod (`paymob` + keys) flow, so they don't
 * interfere with the `npm run build` gate check.
 */
export function withInvariants(env: Env): Env {
  if (env.PAYMENT_PROVIDER === "paymob") {
    const missing = [
      "PAYMOB_API_KEY",
      "PAYMOB_HMAC_SECRET",
      "PAYMOB_INTEGRATION_ID",
      "PAYMOB_IFRAME_ID",
    ].filter((k) => !env[k as keyof Env]);
    if (missing.length) {
      throw new Error(
        `PAYMENT_PROVIDER=paymob requires: ${missing.join(", ")}. Set them in .env or use PAYMENT_PROVIDER=mock.`,
      );
    }
  }
  if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
    throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY.");
  }
  return env;
}

/**
 * Production-readiness POLICY checks. Run at deploy time via `npm run preflight`
 * (CI / pre-release), NOT at module load — because `next build` runs server code
 * with NODE_ENV=production, and a local gate-check build must pass. These guard
 * against shipping a non-production config to a real deployment.
 */
export function productionPreflight(env: Env): string[] {
  const problems: string[] = [];
  if (env.EMAIL_PROVIDER === "console") {
    problems.push(
      "EMAIL_PROVIDER=console must not ship to production (emails would be dropped).",
    );
  }
  if (env.SESSION_SECRET.length < 32) {
    problems.push("SESSION_SECRET must be ≥32 characters in production.");
  }
  if (env.PAYMENT_PROVIDER !== "paymob") {
    problems.push(
      `PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER} is not a real provider; production must use "paymob".`,
    );
  }
  return problems;
}

export const env: Env = withInvariants(parseEnv(process.env));

/** Countries where Cash on Delivery is offered (Egypt on at launch). */
export function isCodEnabledForCountry(countryCode: string): boolean {
  const countries = env.COD_ENABLED_COUNTRIES;
  return countries.includes(countryCode.toUpperCase());
}
