import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-foreground/10 mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Archivio
          </Link>

          <nav className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
            <Link href="/admin" className="transition-colors hover:text-foreground">
              Admin
            </Link>
            <a
              href="https://archivio-platform.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Platform
            </a>
          </nav>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Archivio. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Capture. Print. Share.
          </p>
        </div>
      </div>
    </footer>
  );
}
