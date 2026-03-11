import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { AdminSidebar } from "./admin-sidebar";
import { Footer } from "@/components/footer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {session ? (
        <div className="flex flex-1">
          <AdminSidebar signOut={signOut} />

          <div className="flex flex-1 flex-col">
            {/* Mobile header */}
            <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
              <Link href="/admin" className="font-semibold tracking-tight text-foreground">
                Archivio{" "}
                <span className="text-muted-foreground text-xs">Admin</span>
              </Link>
              <nav className="flex items-center gap-3 text-sm">
                <Link href="/admin/photos" className="text-muted-foreground hover:text-foreground transition-colors">
                  Photos
                </Link>
                <Link href="/admin/capsules" className="text-muted-foreground hover:text-foreground transition-colors">
                  Capsules
                </Link>
                <Link href="/admin/events" className="text-muted-foreground hover:text-foreground transition-colors">
                  Events
                </Link>
                <Link href="/admin/templates" className="text-muted-foreground hover:text-foreground transition-colors">
                  Templates
                </Link>
              </nav>
            </header>

            <main className="flex-1 p-6">{children}</main>
            <Footer />
          </div>
        </div>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </div>
  );
}
