import Link from "next/link";
import { AdminNav } from "@/app/admin/nav";
import { SignOutButton } from "@/app/admin/sign-out";

/**
 * /admin layout — server-rendered shell wrapping every authenticated admin
 * page. The middleware already gated access; this just provides the chrome.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line bg-ivory">
        <div className="container-brand flex h-16 items-center justify-between">
          <Link href="/admin" className="text-meta text-ink">aïoly · admin</Link>
          <SignOutButton />
        </div>
      </header>
      <div className="container-brand grid grid-cols-1 gap-8 py-8 md:grid-cols-[200px_1fr]">
        <AdminNav />
        <main>{children}</main>
      </div>
    </div>
  );
}
