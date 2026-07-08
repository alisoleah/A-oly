/**
 * In-memory token-bucket rate limiter, shared across endpoints.
 *
 * Used for: checkout creation, webhook, admin login. Per-identifier (IP).
 *
 * ⚠️ Single-instance only — doesn't survive multi-instance deploys (Vercel spins
 * up many serverless instances). Acceptable for soft protection now; the upgrade
 * path (Upstash Redis / edge KV) is documented in RUNBOOK.md.
 */

interface Bucket {
  attempts: number;
  firstAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Record an attempt for an identifier within a rate window.
 *
 * @param key namespace (e.g. "checkout", "webhook", "login")
 * @param identifier usually the IP
 * @param maxAttempts allowed within the window
 * @param windowMs window length in ms
 */
export function rateLimit(
  key: string,
  identifier: string,
  maxAttempts: number,
  windowMs: number,
): RateLimitResult {
  const bucketKey = `${key}:${identifier}`;
  const now = Date.now();
  const existing = buckets.get(bucketKey);
  if (!existing || now - existing.firstAt > windowMs) {
    buckets.set(bucketKey, { attempts: 1, firstAt: now });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSeconds: 0 };
  }
  existing.attempts += 1;
  if (existing.attempts > maxAttempts) {
    const retryAfterSeconds = Math.ceil((existing.firstAt + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return { allowed: true, remaining: maxAttempts - existing.attempts, retryAfterSeconds: 0 };
}

/** Clear the bucket for an identifier (e.g. on a successful login). */
export function clearRateLimit(key: string, identifier: string): void {
  buckets.delete(`${key}:${identifier}`);
}

/** Extract a client IP from a request, defaulting to "unknown". */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
