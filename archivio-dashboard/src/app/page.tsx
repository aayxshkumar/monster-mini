"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ArrowRight, Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const envSlug = process.env.NEXT_PUBLIC_CAFE_SLUG;
    if (envSlug) {
      router.replace(`/${envSlug}`);
    }
  }, [router]);

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (trimmed) router.push(`/${trimmed}`);
  };

  if (process.env.NEXT_PUBLIC_CAFE_SLUG) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 font-sans">
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Camera className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
          Archivio Photo Booth
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your cafe identifier to continue
        </p>
        <form onSubmit={handleGo} className="mt-8 flex gap-2">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. blue-bottle-sf"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          >
            Go
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
