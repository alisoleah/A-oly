import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL,
  clearRateLimit,
  createAdminSession,
  rateLimitLogin,
  verifyAdminCredentials,
} from "@/lib/admin/auth";

/**
 * POST /api/admin/login — single-credential admin login.
 *
 *  - Validates input with Zod.
 *  - Rate-limited per IP (5 attempts / 15 min). After the limit, returns 429
 *    with Retry-After. In-memory (upgrade path noted in auth.ts).
 *  - No user enumeration: the error message is identical for a wrong email vs a
 *    wrong password ("Invalid email or password.").
 *  - On success: sets a signed, httpOnly, Secure, SameSite session cookie.
 */
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimitLogin(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const ok = await verifyAdminCredentials(parsed.data.email, parsed.data.password);
  if (!ok) {
    // Identical message for wrong email vs wrong password — no enumeration.
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  clearRateLimit(ip);
  const token = await createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL,
  });
  return res;
}

/** GET → logout: clear the session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
