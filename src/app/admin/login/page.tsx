"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * /admin/login — the only unauthenticated admin route.
 * On success, redirects to the `from` param (or /admin).
 */
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Full-page navigation (not client router) so the freshly-set cookie is
        // guaranteed to be sent with the /admin request.
        const dest = search.get("from") || "/admin";
        window.location.href = dest;
        return;
      }
      setError(data.error ?? "Could not sign in.");
    } catch {
      setError("Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="sm" linked={false} />
        </div>
        <h1 className="font-display text-2xl lowercase mb-1 text-center">admin sign in</h1>
        <p className="text-meta mb-6 text-center">atelier access</p>

        <form onSubmit={submit} className="space-y-4">
          <Input id="email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input id="password" type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
