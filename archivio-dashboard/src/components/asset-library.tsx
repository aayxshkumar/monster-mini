"use client";

import { useCallback, useState } from "react";
import { useBoothStore } from "@/store/booth-store";
import { removeBackground } from "@/lib/bg-removal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Wand2, Loader2, Image as ImageLucide } from "lucide-react";
import { toast } from "sonner";

interface AssetLibraryProps {
  /** Called when user clicks an asset to add it */
  onAddToCanvas?: (asset: { id: string; src: string; name: string; type: "image" | "sticker" }) => void;
  /** Max height for scroll area */
  maxHeight?: string;
  /** Number of columns */
  cols?: 2 | 3 | 4;
}

export function AssetLibrary({ onAddToCanvas, maxHeight = "max-h-64", cols = 2 }: AssetLibraryProps) {
  const assetLibrary = useBoothStore((s) => s.assetLibrary);
  const removeAsset = useBoothStore((s) => s.removeAsset);
  const updateAsset = useBoothStore((s) => s.updateAsset);

  const [removingBg, setRemovingBg] = useState<Set<string>>(new Set());
  const [bgProgress, setBgProgress] = useState<Record<string, string>>({});

  const handleRemoveBg = useCallback(async (assetId: string, src: string) => {
    setRemovingBg((prev) => new Set(prev).add(assetId));
    setBgProgress((prev) => ({ ...prev, [assetId]: "Starting..." }));
    try {
      const newUrl = await removeBackground(src, (msg) => {
        setBgProgress((prev) => ({ ...prev, [assetId]: msg }));
      });
      // Revoke old blob URL to free memory
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      updateAsset(assetId, { src: newUrl });
      toast.success("Background removed!");
    } catch (err) {
      console.error("[BG Removal] Failed:", err);
      toast.error("Background removal failed");
    } finally {
      setRemovingBg((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
      setBgProgress((prev) => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }
  }, [updateAsset]);

  const gridClass = cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Assets
        </Label>
        <span className="text-[9px] text-muted-foreground/60">{assetLibrary.length} items</span>
      </div>
      {assetLibrary.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ImageLucide className="h-6 w-6 text-muted-foreground/30 mb-1.5" />
          <p className="text-[10px] text-muted-foreground/50">
            Imported assets appear here
          </p>
        </div>
      ) : (
        <ScrollArea className={maxHeight}>
          <div className={`grid ${gridClass} gap-2 p-0.5`}>
            {assetLibrary.map((asset) => {
              const isRemoving = removingBg.has(asset.id);
              return (
                <div key={asset.id} className="group relative rounded-lg overflow-visible">
                  <button
                    onClick={() => onAddToCanvas?.(asset)}
                    className="w-full rounded-lg border border-border/60 transition-all duration-150 hover:border-blue-400 hover:shadow-sm active:scale-[0.97]"
                    title={asset.name}
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
                        src={asset.src}
                        alt=""
                        className={`w-full h-full object-contain p-1 ${isRemoving ? "opacity-30 blur-[1px]" : ""}`}
                      />
                      {isRemoving && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 gap-1">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                          <span className="text-[8px] font-medium text-violet-600 text-center px-1 animate-pulse">
                            {bgProgress[asset.id] || "Removing BG..."}
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
                        handleRemoveBg(asset.id, asset.src);
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
                        removeAsset(asset.id);
                      }}
                      title="Remove from library"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
