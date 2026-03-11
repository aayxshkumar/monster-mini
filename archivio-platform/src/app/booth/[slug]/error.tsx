"use client";

import { useEffect } from "react";

export default function BoothError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Booth Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h2 className="text-lg font-semibold">Booth Error</h2>
        <p className="text-sm text-muted-foreground">
          Could not load the photo booth. Check your network connection and try
          again.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
