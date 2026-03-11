"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Template = {
  id: string;
  name: string;
  description: string;
  bg: string;
  textColor: string;
};

const TEMPLATES: Template[] = [
  { id: "minimal", name: "Minimal", description: "Clean white frame", bg: "#ffffff", textColor: "#333333" },
  { id: "dark", name: "Dark", description: "Dark elegant frame", bg: "#1a1a1a", textColor: "#ffffff" },
  { id: "gradient", name: "Gradient", description: "Colorful gradient", bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", textColor: "#ffffff" },
  { id: "warm", name: "Warm", description: "Warm sunset tones", bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", textColor: "#ffffff" },
  { id: "ocean", name: "Ocean", description: "Cool ocean blue", bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", textColor: "#ffffff" },
  { id: "film", name: "Film Strip", description: "Retro film look", bg: "#000000", textColor: "#cccccc" },
];

type InstagramShareButtonProps = {
  photoId: string;
  imageUrl: string;
  originalUrl?: string | null;
  className?: string;
};

export function InstagramShareButton({
  photoId,
  imageUrl,
  originalUrl,
  className,
}: InstagramShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("minimal");
  const [generating, setGenerating] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cleanupPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setGeneratedBlob(null);
  }, [previewUrl]);

  const generateTemplatedImage = useCallback(async (templateId: string) => {
    setGenerating(true);
    cleanupPreview();

    try {
      const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
      const srcUrl = (templateId === "minimal" || templateId === "dark") ? imageUrl : (originalUrl || imageUrl);

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = srcUrl;
      });

      // Instagram story dimensions: 1080x1920 (9:16)
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Draw background
      if (template.bg.startsWith("linear-gradient")) {
        const colors = template.bg.match(/#[0-9a-fA-F]{6}/g) || ["#667eea", "#764ba2"];
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1] || colors[0]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = template.bg;
      }
      ctx.fillRect(0, 0, W, H);

      if (templateId === "film") {
        drawFilmTemplate(ctx, img, W, H, template);
      } else {
        drawFrameTemplate(ctx, img, W, H, template, templateId);
      }

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png", 1.0)
      );

      setGeneratedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Template generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [imageUrl, originalUrl, cleanupPreview]);

  useEffect(() => {
    if (open) generateTemplatedImage(selectedTemplate);
  }, [open, selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async (target: "story" | "dm" | "feed" | "general") => {
    if (!generatedBlob) return;

    const file = new File([generatedBlob], `archivio-photo-${photoId}.png`, { type: "image/png" });

    // Use Web Share API — on mobile this opens the share sheet where user picks Instagram
    if (navigator.share) {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "My photobooth photo",
            files: [file],
          });
          setOpen(false);
          return;
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }

    // Desktop fallback: copy to clipboard so they can paste into Instagram
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": generatedBlob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    } catch {
      // final fallback: download
    }

    const url = URL.createObjectURL(generatedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archivio-${target}-${photoId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button
        variant="outline"
        size="default"
        className={className}
        onClick={() => setOpen(true)}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        Share to Instagram
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => { cleanupPreview(); setOpen(false); }}
        >
          <div
            className="bg-background rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b">
              <h3 className="font-semibold text-lg">Share to Instagram</h3>
              <p className="text-sm text-muted-foreground mt-1">Choose a template for your photo</p>
            </div>

            {/* Template picker */}
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`rounded-lg p-2 text-left border-2 transition-all ${
                      selectedTemplate === t.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <div
                      className="w-full aspect-9/16 rounded-md mb-1.5"
                      style={{
                        background: t.bg.startsWith("linear") ? t.bg : t.bg,
                        border: t.bg === "#ffffff" ? "1px solid #e5e5e5" : "none",
                      }}
                    />
                    <p className="text-xs font-medium truncate">{t.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="px-4 pb-4">
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 flex justify-center">
                {generating ? (
                  <div className="w-[180px] aspect-9/16 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Template preview"
                    className="w-[180px] aspect-9/16 object-contain rounded-md"
                  />
                ) : null}
              </div>
            </div>

            {/* Share buttons */}
            <div className="p-4 border-t space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => handleShare("story")}
                  disabled={!generatedBlob || generating}
                  className="bg-linear-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                >
                  Story
                </Button>
                <Button
                  onClick={() => handleShare("feed")}
                  disabled={!generatedBlob || generating}
                  className="bg-linear-to-br from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 text-white"
                >
                  Feed
                </Button>
                <Button
                  onClick={() => handleShare("dm")}
                  disabled={!generatedBlob || generating}
                  className="bg-linear-to-br from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                >
                  DM
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-center text-green-600 dark:text-green-400 font-medium">
                  Copied to clipboard — paste it in Instagram!
                </p>
              )}
              <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
                On mobile, your share sheet will open — pick <strong>Instagram</strong>.<br />
                On desktop, the image is copied to clipboard — open Instagram and paste.
              </p>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => { cleanupPreview(); setOpen(false); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function drawFrameTemplate(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  template: Template,
  templateId: string,
) {
  const padding = templateId === "minimal" || templateId === "dark" ? 60 : 80;
  const maxPhotoW = W - padding * 2;
  const maxPhotoH = H - padding * 2 - 120;

  const imgAspect = img.width / img.height;
  let drawW: number, drawH: number;
  if (imgAspect > maxPhotoW / maxPhotoH) {
    drawW = maxPhotoW;
    drawH = maxPhotoW / imgAspect;
  } else {
    drawH = maxPhotoH;
    drawW = maxPhotoH * imgAspect;
  }

  const x = (W - drawW) / 2;
  const y = (H - drawH - 60) / 2;

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;

  if (templateId === "minimal" || templateId === "dark") {
    const framePad = 16;
    ctx.fillStyle = templateId === "dark" ? "#2a2a2a" : "#ffffff";
    roundRect(ctx, x - framePad, y - framePad, drawW + framePad * 2, drawH + framePad * 2 + 40, 8);
    ctx.fill();
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Draw photo with rounded corners
  ctx.save();
  roundRect(ctx, x, y, drawW, drawH, 6);
  ctx.clip();
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();

  // Watermark
  ctx.fillStyle = template.textColor;
  ctx.globalAlpha = 0.6;
  ctx.font = "500 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Archivio", W / 2, H - 60);
  ctx.globalAlpha = 1;
}

function drawFilmTemplate(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  template: Template,
) {
  // Film strip holes
  const holeSize = 24;
  const holeGap = 48;
  const stripW = 80;

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, stripW, H);
  ctx.fillRect(W - stripW, 0, stripW, H);

  for (let y = 20; y < H; y += holeGap) {
    ctx.fillStyle = "#333";
    roundRect(ctx, (stripW - holeSize) / 2, y, holeSize, holeSize, 4);
    ctx.fill();
    roundRect(ctx, W - stripW + (stripW - holeSize) / 2, y, holeSize, holeSize, 4);
    ctx.fill();
  }

  // Photo area
  const photoAreaX = stripW + 20;
  const photoAreaW = W - stripW * 2 - 40;
  const photoAreaH = H - 200;

  const imgAspect = img.width / img.height;
  let drawW: number, drawH: number;
  if (imgAspect > photoAreaW / photoAreaH) {
    drawW = photoAreaW;
    drawH = photoAreaW / imgAspect;
  } else {
    drawH = photoAreaH;
    drawW = photoAreaH * imgAspect;
  }

  const x = photoAreaX + (photoAreaW - drawW) / 2;
  const y = (H - drawH - 80) / 2;

  ctx.drawImage(img, x, y, drawW, drawH);

  // Film text
  ctx.fillStyle = template.textColor;
  ctx.globalAlpha = 0.5;
  ctx.font = "italic 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Archivio Photobooth", W / 2, H - 60);
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
