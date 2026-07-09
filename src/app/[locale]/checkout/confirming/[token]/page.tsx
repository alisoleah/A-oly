import { ConfirmingClient } from "./client";

export const dynamic = "force-dynamic";

/**
 * /[locale]/checkout/confirming/[token] — "Confirming your payment…" page.
 *
 * INVARIANT (CLAUDE.md, TESTING_GUIDE.md §4): this page NEVER sets the order
 * status. It only READS it (polls) and reflects what the webhook did. Success
 * is shown only after the server confirms PAID — never on the client redirect.
 */

export default async function ConfirmingPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = await params;
  return <ConfirmingClient token={token} />;
}
