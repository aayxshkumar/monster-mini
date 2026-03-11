"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export function Footer() {
  const params = useParams<{ cafeSlug: string }>();
  const base = params.cafeSlug ? `/${params.cafeSlug}` : "";

  return (
    <footer className="border-t border-border mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link href={base || "/"} className="text-sm font-semibold tracking-tight text-foreground">
            Archivio
          </Link>

          <nav className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href={base || "/"} className="transition-colors hover:text-foreground">
              Dashboard
            </Link>
            <Link href={`${base}/templates`} className="transition-colors hover:text-foreground">
              Templates
            </Link>
            <Link href={`${base}/gallery`} className="transition-colors hover:text-foreground">
              Gallery
            </Link>
            <Link href={`${base}/create`} className="transition-colors hover:text-foreground">
              Create
            </Link>
          </nav>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Archivio. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Print your moments.
          </p>
        </div>
      </div>
    </footer>
  );
}
