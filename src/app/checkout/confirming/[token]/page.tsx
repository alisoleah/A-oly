import { ConfirmingClient } from "@/app/checkout/confirming/[token]/client";

export const dynamic = "force-dynamic";

/**
 * /checkout/confirming/[token] — "Confirming your payment…" page.
 *
 * INVARIANT (CLAUDE.md, TESTING_GUIDE.md §4): this page NEVER sets the order
 * status. It only READS it (polls) and reflects what the webhook did. Success
 * is shown only after the server confirms PAID — never on the client redirect.
 */

export default async function ConfirmingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConfirmingClient token={token} />;
}
