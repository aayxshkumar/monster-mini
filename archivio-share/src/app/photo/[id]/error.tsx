"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PhotoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isNotFound =
    error.message?.includes("Not found") ||
    error.message?.toLowerCase().includes("not found") ||
    error.digest === "NEXT_NOT_FOUND";
  const isExpired = error.message?.toLowerCase().includes("expired");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 font-sans">
      <h1 className="text-xl font-semibold">
        {isExpired
          ? "This photo has expired"
          : isNotFound
            ? "This link doesn't match any photo"
            : "Something went wrong"}
      </h1>
      <p className="text-muted-foreground mt-2 text-center">
        {isExpired
          ? "Photos are available for a limited time."
          : isNotFound
            ? "The photo may have been removed or the link is incorrect."
            : "We couldn't load this photo. Please try again."}
      </p>
      <div className="mt-6 flex gap-3">
        {!isNotFound && !isExpired && (
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        )}
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
