"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useBoothStore } from "@/store/booth-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Wand2, Loader2 } from "lucide-react";

/** Remove background from an image blob using @imgly/background-removal (WASM, runs client-side) */
async function removeBackground(imageUrl: string): Promise<string> {
  const { removeBackground: removeBg } = await import("@imgly/background-removal");
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const resultBlob = await removeBg(blob, {
    progress: (key: string, current: number, total: number) => {
      console.log(`[BG Removal] ${key}: ${Math.round((current / total) * 100)}%`);
    },
  });
  return URL.createObjectURL(resultBlob);
}

export function StickerPanel() {
  const { stickerLibrary, addStickerToLibrary, removeStickerFromLibrary, addSticker } =
    useBoothStore();
  const updateLibraryItem = useBoothStore((s) => s.updateStickerLibraryItem);

  // Track which stickers are having BG removed
  const [removingBg, setRemovingBg] = useState<Set<string>>(new Set());

  const handleRemoveBg = useCallback(async (id: string, src: string) => {
    setRemovingBg((prev) => new Set(prev).add(id));
    try {
      const newUrl = await removeBackground(src);
      // Replace the sticker in the library with the bg-removed version
      if (updateLibraryItem) {
        updateLibraryItem(id, newUrl);
      }
    } catch (err) {
      console.error("[BG Removal] Failed:", err);
    } finally {
      setRemovingBg((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [updateLibraryItem]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach((file) => {
        // For HEIC/HEIF, convert to PNG via canvas so browser can render it
        if (file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif") {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) {
                  const pngUrl = URL.createObjectURL(blob);
                  addStickerToLibrary(pngUrl);
                } else {
                  addStickerToLibrary(url);
                }
              }, "image/png");
            } else {
              addStickerToLibrary(url);
            }
          };
          img.onerror = () => {
            addStickerToLibrary(url);
          };
          img.src = url;
        } else {
          const url = URL.createObjectURL(file);
          addStickerToLibrary(url);
        }
      });
    },
    [addStickerToLibrary]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tiff", ".avif"],
    },
  });

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Stickers & Overlays
      </h3>

      {/* Upload zone */}
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
        <p className="mt-1 text-[10px] text-muted-foreground">Any image format (PNG, JPG, HEIC…)</p>
        <p className="text-[9px] text-muted-foreground/50">Auto-remove background available</p>
      </div>

      {/* Sticker grid */}
      <ScrollArea className="mt-3 flex-1">
        {stickerLibrary.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground/50">
            No stickers yet. Drop images above.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {stickerLibrary.map((s) => {
              const isRemoving = removingBg.has(s.id);
              return (
                <div key={s.id} className="group relative">
                  <button
                    onClick={() => addSticker(s.src)}
                    className="w-full overflow-hidden rounded-md border p-1 transition-colors hover:bg-muted/60"
                    title="Click to add to receipt"
                    disabled={isRemoving}
                  >
                    {/* Checkerboard background to show transparency */}
                    <div
                      className="aspect-square w-full rounded-sm relative"
                      style={{
                        backgroundImage: "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
                        backgroundSize: "8px 8px",
                        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                      }}
                    >
                      <img src={s.src} alt="" className={`aspect-square w-full object-contain ${isRemoving ? "opacity-40" : ""}`} />
                      {isRemoving && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Remove BG button — bottom-left */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-violet-600 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-violet-700"
                    onClick={(e) => { e.stopPropagation(); handleRemoveBg(s.id, s.src); }}
                    disabled={isRemoving}
                    title="Remove background"
                  >
                    <Wand2 className="h-2.5 w-2.5" />
                  </Button>

                  {/* Delete button — top-right */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeStickerFromLibrary(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
