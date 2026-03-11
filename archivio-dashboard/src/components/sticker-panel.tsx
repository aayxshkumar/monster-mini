"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useBoothStore } from "@/store/booth-store";
import { useCafeConfig } from "@/lib/cafe-config";
import { removeBackground } from "@/lib/bg-removal";
import { AssetLibrary } from "@/components/asset-library";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FALLBACK_QUOTES = ["Preparing your sticker...", "Almost there...", "Working on it..."];

export function StickerPanel() {
  const can = useCafeConfig((s) => s.can);
  const stickerLibrary = useBoothStore((s) => s.stickerLibrary);
  const addStickerToLibrary = useBoothStore((s) => s.addStickerToLibrary);
  const removeStickerFromLibrary = useBoothStore((s) => s.removeStickerFromLibrary);
  const addSticker = useBoothStore((s) => s.addSticker);
  const updateLibraryItem = useBoothStore((s) => s.updateStickerLibraryItem);
  const addAsset = useBoothStore((s) => s.addAsset);
  const savedMemos = useBoothStore((s) => s.savedMemos);
  const loadingQuotes = savedMemos.length > 0 ? savedMemos : FALLBACK_QUOTES;

  // Track which stickers are having BG removed
  const [removingBg, setRemovingBg] = useState<Set<string>>(new Set());
  const [bgProgress, setBgProgress] = useState<Record<string, string>>({});
  // Full-screen uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("Importing sticker...");

  // Cycle through fun quotes while loading
  const [quoteIndex, setQuoteIndex] = useState(0);
  const quoteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (uploading) {
      setQuoteIndex(Math.floor(Math.random() * loadingQuotes.length));
      quoteIntervalRef.current = setInterval(() => {
        setQuoteIndex((i) => (i + 1) % loadingQuotes.length);
      }, 2500);
    } else if (quoteIntervalRef.current) {
      clearInterval(quoteIntervalRef.current);
      quoteIntervalRef.current = null;
    }
    return () => { if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current); };
  }, [uploading, loadingQuotes.length]);

  const handleRemoveBg = useCallback(async (id: string, src: string) => {
    setRemovingBg((prev) => new Set(prev).add(id));
    setBgProgress((prev) => ({ ...prev, [id]: "Starting..." }));
    try {
      const newUrl = await removeBackground(src, (msg) => {
        setBgProgress((prev) => ({ ...prev, [id]: msg }));
      });
      // Revoke old blob URL to free memory
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      if (updateLibraryItem) {
        updateLibraryItem(id, newUrl);
      }
      toast.success("Background removed!");
    } catch (err) {
      console.error("[BG Removal] Failed:", err);
      toast.error("Background removal failed");
    } finally {
      setRemovingBg((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setBgProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [updateLibraryItem]);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        setUploading(true);
        setUploadProgress("Preparing image...");
        try {
          let url = URL.createObjectURL(file);

          // For HEIC/HEIF, convert to PNG via canvas
          if (
            file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif") ||
            file.type === "image/heic" ||
            file.type === "image/heif"
          ) {
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = url;
            });
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const blob = await new Promise<Blob | null>((res) =>
                canvas.toBlob((b) => res(b), "image/png")
              );
              if (blob) url = URL.createObjectURL(blob);
            }
          }

          // Auto remove background
          try {
            const originalUrl = url;
            const bgRemovedUrl = await removeBackground(url, (msg) => {
              setUploadProgress(msg);
            });
            // Revoke old blob URL to free memory
            if (originalUrl.startsWith("blob:")) URL.revokeObjectURL(originalUrl);
            url = bgRemovedUrl;
            toast.success("Background removed!");
          } catch (err) {
            console.error("[BG Removal] Failed:", err);
            setUploadProgress("BG removal failed, using original...");
            toast.warning("BG removal failed, using original");
          }

          addStickerToLibrary(url);
          // Also add to shared asset library
          addAsset({ id: `asset_${Date.now()}`, src: url, name: file.name, type: "sticker" });
        } catch (err) {
          console.error("[Sticker Import] Failed:", err);
          toast.error("Failed to import sticker");
        } finally {
          setUploading(false);
        }
      }
    },
    [addStickerToLibrary, addAsset]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tiff", ".avif"],
    },
  });

  // Load image dimensions then add sticker at correct aspect ratio
  const addStickerWithDimensions = useCallback((src: string) => {
    const img = new Image();
    img.onload = () => addSticker(src, img.naturalWidth, img.naturalHeight);
    img.onerror = () => addSticker(src);
    img.src = src;
  }, [addSticker]);

  // Handle adding asset from shared library to receipt canvas
  const handleAddAssetToReceipt = useCallback((asset: { src: string }) => {
    addStickerWithDimensions(asset.src);
  }, [addStickerWithDimensions]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Uploading overlay */}
      {uploading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg px-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-3" />
          <p className="text-sm font-semibold text-center italic leading-snug transition-opacity duration-500">&ldquo;{loadingQuotes[quoteIndex % loadingQuotes.length]}&rdquo;</p>
          <p className="text-[10px] text-muted-foreground mt-2 animate-pulse">{uploadProgress}</p>
        </div>
      )}

      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Stickers & Overlays
      </h3>

      {/* Upload zone — gated by canUploadStickers */}
      {can("canUploadStickers") && (
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
          isDragActive
            ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
      >
        <input {...getInputProps()} />
        <Plus className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-1 text-[10px] text-muted-foreground">Drop stickers here</p>
        <p className="text-[9px] text-muted-foreground/50">Auto-removes background</p>
      </div>
      )}

      {/* Sticker grid (receipt stickers) */}
      <ScrollArea className="mt-3 flex-1">
        {stickerLibrary.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-muted-foreground/50">
            No stickers yet. Drop images above.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stickerLibrary.map((s) => {
              const isRemoving = removingBg.has(s.id);
              return (
                <div key={s.id} className="group relative rounded-lg overflow-visible">
                  <button
                    onClick={() => addStickerWithDimensions(s.src)}
                    className="w-full rounded-lg border border-border/60 transition-all duration-150 hover:border-blue-400 hover:shadow-sm active:scale-[0.97]"
                    title="Click to add to receipt"
                    disabled={isRemoving}
                  >
                    <div
                      className="aspect-square w-full rounded-lg relative overflow-hidden"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)",
                        backgroundSize: "8px 8px",
                        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                      }}
                    >
                      <img
                        src={s.src}
                        alt=""
                        className={`w-full h-full object-contain p-1 ${isRemoving ? "opacity-30 blur-[1px]" : ""}`}
                      />
                      {isRemoving && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 gap-1">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                          <span className="text-[8px] font-medium text-violet-600 text-center px-1 animate-pulse">
                            {bgProgress[s.id] || "Removing BG..."}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Hover overlay with action buttons */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-6 w-6 rounded-md bg-violet-600 text-white shadow-md hover:bg-violet-700 pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBg(s.id, s.src);
                      }}
                      disabled={isRemoving}
                      title="Remove background"
                    >
                      <Wand2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-6 w-6 rounded-md bg-red-500 text-white shadow-md hover:bg-red-600 pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStickerFromLibrary(s.id);
                      }}
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Shared Asset Library */}
      <Separator className="my-3" />
      <AssetLibrary onAddToCanvas={handleAddAssetToReceipt} cols={2} maxHeight="max-h-48" />
    </div>
  );
}
