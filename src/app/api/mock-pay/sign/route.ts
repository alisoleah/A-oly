import { NextResponse } from "next/server";
import { computeHmac } from "@/lib/payments/hmac";
import { MOCK_HMAC_SECRET } from "@/lib/payments/mock-provider";

/**
 * /api/mock-pay/sign — signs a fake webhook payload with the mock secret.
 *
 * Dev/test ONLY (the mock provider is never used in production). The HMAC secret
 * stays server-side; the browser never sees it. This lets the mock pay page POST
 * a correctly-signed webhook to /api/webhooks/mock, exercising the real verify
 * path end-to-end.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = computeHmac(MOCK_HMAC_SECRET, body);
  return NextResponse.json({ signature });
}
