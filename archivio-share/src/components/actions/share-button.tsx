"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Download, Mail, QrCode } from "lucide-react";

const APP_URL =
  typeof window !== "undefined" ? window.location.origin : "";

type ShareButtonProps = {
  photoId: string;
  photoUrl: string;
  imageUrl: string | null;
  className?: string;
};

export function ShareButton({
  photoId,
  photoUrl,
  imageUrl,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  const fullUrl = photoUrl.startsWith("http") ? photoUrl : `${APP_URL}${photoUrl}`;

  const handleShare = async () => {
    if (navigator.share && imageUrl) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], "archivio-photo.webp", { type: "image/webp" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "My photobooth photo",
            text: "Check out my photo!",
            files: [file],
            url: fullUrl,
          });
          return;
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    setShowFallback(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowFallback(true);
    }
  };

  const downloadFallback = () => {
    if (imageUrl) {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = `archivio-photo-${photoId}.webp`;
      a.click();
    }
  };

  const mailto = () => {
    const subject = encodeURIComponent("My photobooth photo");
    const body = encodeURIComponent(`Check out my photo: ${fullUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  if (showFallback) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="default"
          className={className}
          onClick={copyLink}
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : "Copy link"}
        </Button>
        {imageUrl && (
          <Button variant="outline" size="default" onClick={downloadFallback}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        )}
        <Button variant="outline" size="default" onClick={mailto}>
          <Mail className="h-4 w-4" />
          Email
        </Button>
        <Button
          variant="ghost"
          size="default"
          onClick={() => setShowFallback(false)}
        >
          <QrCode className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="default"
      className={className}
      onClick={handleShare}
    >
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  );
}
