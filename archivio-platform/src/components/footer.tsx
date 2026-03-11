import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            Archivio
          </Link>

          <nav className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/admin" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/cafes" className="transition-colors hover:text-foreground">
              Cafes
            </Link>
            <Link href="/admin/audit" className="transition-colors hover:text-foreground">
              Audit log
            </Link>
            <Link href="/admin/settings" className="transition-colors hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Archivio. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Photo booth management platform
          </p>
        </div>
      </div>
    </footer>
  );
}
