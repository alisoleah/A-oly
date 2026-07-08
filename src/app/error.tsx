"use client";

import { Button } from "@/components/ui/Button";

/**
 * Custom 500 / runtime error boundary.
 *
 * Never exposes stack traces or internals to the customer. The actual error is
 * logged server-side by Next.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-brand flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-meta mb-3">something went wrong</p>
      <h1 className="font-display text-4xl md:text-5xl lowercase mb-4">
        a moment, please
      </h1>
      <p className="text-ink-soft mb-8 max-w-sm">
        We hit an unexpected snag. Your bag is safe — try again, or return shortly.
      </p>
      <Button variant="ghost" onClick={reset}>Try again</Button>
    </div>
  );
}
