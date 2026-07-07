"use client";

import { useRouter } from "next/navigation";

/** Sign-out: DELETEs the session cookie via the login route, then reloads. */
export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className="text-meta text-ink-soft hover:text-ink">
      Sign out
    </button>
  );
}
