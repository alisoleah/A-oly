import { NextResponse } from "next/server";
import { sweepAbandonedPayments } from "@/lib/orders/sweep";

/**
 * Cron endpoint for the reservation TTL sweep.
 *
 * Vercel cron (or any scheduler) GETs this on a schedule (e.g. every 10 min).
 * Protected by a CRON_SECRET query param so it can't be triggered arbitrarily.
 * Schedule it in vercel.json (see docs/DEPLOYMENT.md for the cron config).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sweepAbandonedPayments();
  return NextResponse.json({ ok: true, ...result });
}
