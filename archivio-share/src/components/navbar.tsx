import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-base font-bold tracking-tight text-foreground">
          Archivio
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="#how-it-works"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            How it works
          </Link>
          <Link
            href="#find-photo"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Scan my receipt
          </Link>
        </nav>
      </div>
    </header>
  );
}
