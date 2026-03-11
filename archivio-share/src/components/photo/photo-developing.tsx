"use client";

import { useEffect } from "react";

export function PhotoDeveloping({ photoId }: { photoId: string }) {
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/photo/${photoId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "uploaded") {
            window.location.reload();
            return;
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(t);
  }, [photoId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#faf8f5]">
      <div className="w-full max-w-sm text-center">
        <div className="inline-block w-16 h-16 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin mb-6" />
        <h2 className="text-lg font-medium text-foreground">
          Your photo is on its way...
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          We&apos;re still developing your photo. This page will update
          automatically in a few seconds.
        </p>
      </div>
    </div>
  );
}
