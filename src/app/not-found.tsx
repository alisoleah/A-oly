import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Custom 404 — brand-consistent, never exposes internals.
 */
export default function NotFound() {
  return (
    <div className="container-brand flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-meta mb-3">404</p>
      <h1 className="font-display text-4xl md:text-5xl lowercase mb-4">
        this page isn&apos;t here
      </h1>
      <p className="text-ink-soft mb-8 max-w-sm">
        The page may have moved, or the link may be broken. Let us get you back.
      </p>
      <Button href="/" variant="ghost">Back to home</Button>
      <div className="mt-6 flex gap-4 text-meta">
        <Link href="/aether" className="hover:text-gold">Aether</Link>
        <Link href="/aethra" className="hover:text-gold">Aethra</Link>
      </div>
    </div>
  );
}
