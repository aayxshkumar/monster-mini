"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const APP_URL =
  typeof window !== "undefined" ? window.location.origin : "";

type SaveButtonProps = {
  photoId: string;
  imageUrl: string | null;
  className?: string;
};

export function SaveButton({ photoId, imageUrl, className }: SaveButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Use the download API so iOS gets Content-Disposition: attachment
      const url = `${APP_URL}/api/photo/${photoId}/download`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `archivio-photo-${photoId}.webp`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab (user can save from there)
      if (imageUrl) {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = `archivio-photo-${photoId}.webp`;
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="default"
      className={className}
      onClick={handleSave}
      disabled={loading}
    >
      <Download className="h-4 w-4" />
      {loading ? "Saving…" : "Save"}
    </Button>
  );
}
