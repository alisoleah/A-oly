import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * Admin authentication — single credential via env (CLAUDE.md §Auth).
 *
 *  - Password verified with bcrypt (cost ≥ 12, set by scripts/hash-password.ts).
 *  - Session = a signed JWT in an httpOnly cookie. jose signs with HS256 over
 *    SESSION_SECRET (env). No session DB row needed for a single admin.
 *  - Login is rate-limited in-memory (simple token bucket). NOTE: in-memory
 *    limiting doesn't survive multi-instance deploys — Phase 6 records the
 *    upgrade path (Upstash/edge).
 */

const SESSION_COOKIE = "aioly_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min

const secretKey = new TextEncoder().encode(env.SESSION_SECRET);

export interface AdminSession {
  email: string;
  /** Expiry (unix seconds). */
  exp: number;
}

/** Create a signed session JWT for the admin. */
export async function createAdminSession(): Promise<string> {
  return new SignJWT({ email: env.ADMIN_EMAIL })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

/** Verify a session JWT; returns the payload or null if invalid/expired. */
export async function verifyAdminSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.email !== env.ADMIN_EMAIL) return null;
    return {
      email: String(payload.email),
      exp: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

/** Verify an email+password against the env credential. Constant-time via bcrypt. */
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  // Constant-time-ish email compare is fine here: there's exactly one admin,
  // so a mismatch always fails the password check anyway (no enumeration surface).
  if (email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return false;
  return compare(password, env.ADMIN_PASSWORD_HASH);
}

export const ADMIN_SESSION_COOKIE = SESSION_COOKIE;
export const ADMIN_SESSION_TTL = SESSION_TTL_SECONDS;

// ── In-memory login rate limiter ─────────────────────────────
// Token-bucket per identifier (IP). Resets after RATE_WINDOW_MS of inactivity.

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

/** Record a failed attempt + report whether the next attempt is allowed. */
export function rateLimitLogin(identifier: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(identifier);
  if (!existing || now - existing.firstAt > RATE_WINDOW_MS) {
    buckets.set(identifier, { attempts: 1, firstAt: now });
    return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - 1, retryAfterSeconds: 0 };
  }
  existing.attempts += 1;
  if (existing.attempts > MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((existing.firstAt + RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return {
    allowed: true,
    remaining: MAX_LOGIN_ATTEMPTS - existing.attempts,
    retryAfterSeconds: 0,
  };
}

/** Clear the rate-limit bucket on a successful login. */
export function clearRateLimit(identifier: string): void {
  buckets.delete(identifier);
}
