"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useBoothStore, type GridPhoto } from "@/store/booth-store";
import { GRID_LAYOUTS, getLayoutsForCount } from "@/lib/grid-layouts";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Shuffle, Plus, X, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function PhotoGridEditor() {
  const {
    gridPhotos,
    gridLayout,
    gridCanvasMode,
    addGridPhoto,
    removeGridPhoto,
    shuffleGridLayout,
    setGridCanvasMode,
  } = useBoothStore();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        const id = `grid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const preview = URL.createObjectURL(file);
        // Upload to Pi immediately
        let filename = "";
        try {
          const res = await api.uploadPhoto(file);
          filename = res.filename;
        } catch { /* will upload at print time */ }
        const gp: GridPhoto = { id, preview, filename, cropData: null };
        addGridPhoto(gp);
      }
    },
    [addGridPhoto]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
  });

  const count = gridPhotos.length;
  const availableLayouts = getLayoutsForCount(count);
  const cells = GRID_LAYOUTS[gridLayout] || GRID_LAYOUTS["1-full"];

  return (
    <div className="space-y-3">
      {/* Grid images row */}
      <div className="flex flex-wrap gap-2">
        {gridPhotos.map((photo) => (
          <div key={photo.id} className="group relative h-16 w-16 overflow-hidden rounded-md border">
            <img src={photo.preview} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => removeGridPhoto(photo.id)}
              className="absolute -top-1 -right-1 rounded-full bg-black/80 p-0.5 text-white opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {count < 6 && (
          <div
            {...getRootProps()}
            className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40"
          >
            <input {...getInputProps()} />
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Layout controls */}
      {count >= 2 && (
        <div className="flex items-center gap-2">
          {/* Layout thumbnails */}
          <div className="flex gap-1.5">
            {availableLayouts.map((layoutKey) => {
              const layoutCells = GRID_LAYOUTS[layoutKey];
              return (
                <button
                  key={layoutKey}
                  onClick={() => useBoothStore.getState().setGridLayout(layoutKey)}
                  className={`h-8 w-8 overflow-hidden rounded border p-0.5 ${
                    gridLayout === layoutKey ? "border-foreground" : "border-muted"
                  }`}
                >
                  <div className="relative h-full w-full">
                    {layoutCells.map((cell) => (
                      <div
                        key={cell.id}
                        className="absolute border border-muted-foreground/30 bg-muted"
                        style={{
                          left: `${cell.x}%`,
                          top: `${cell.y}%`,
                          width: `${cell.w}%`,
                          height: `${cell.h}%`,
                        }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={shuffleGridLayout}>
            <Shuffle className="h-3.5 w-3.5" />
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[10px] text-muted-foreground">Freestyle</Label>
            <Switch
              checked={gridCanvasMode}
              onCheckedChange={setGridCanvasMode}
              className="scale-75"
            />
          </div>
        </div>
      )}

      {/* Mini preview */}
      {count > 0 && (
        <div className="relative h-40 w-full overflow-hidden rounded-md border bg-muted/20">
          {gridCanvasMode ? (
            gridPhotos.map((photo) => (
              <DraggableGridPhoto key={photo.id} photo={photo} />
            ))
          ) : (
            cells.slice(0, count).map((cell, i) => {
              const photo = gridPhotos[i];
              if (!photo) return null;
              return (
                <div
                  key={cell.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${cell.x}%`,
                    top: `${cell.y}%`,
                    width: `${cell.w}%`,
                    height: `${cell.h}%`,
                    padding: "1px",
                  }}
                >
                  <img
                    src={photo.preview}
                    alt=""
                    className="h-full w-full rounded-sm object-cover"
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function DraggableGridPhoto({ photo }: { photo: GridPhoto }) {
  const updatePos = useBoothStore((s) => s.updateGridPhotoPos);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const x = photo.x ?? 5;
  const y = photo.y ?? 5;
  const w = photo.w ?? 60;
  const h = photo.h ?? 60;

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    startRef.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dx = e.clientX - startRef.current.mx;
      const dy = e.clientY - startRef.current.my;
      const pxToPercX = 100 / rect.width;
      const pxToPercY = 100 / rect.height;
      updatePos(photo.id, {
        x: Math.max(-10, Math.min(90, startRef.current.ox + dx * pxToPercX)),
        y: Math.max(-10, Math.min(90, startRef.current.oy + dy * pxToPercY)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, photo.id, updatePos]);

  return (
    <div
      ref={containerRef}
      className="absolute cursor-grab active:cursor-grabbing rounded-sm overflow-hidden border-2 border-transparent hover:border-white/50 transition-colors shadow-md"
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, zIndex: dragging ? 10 : 1 }}
      onMouseDown={onDown}
    >
      <img src={photo.preview} alt="" className="h-full w-full object-cover pointer-events-none" draggable={false} />
    </div>
  );
}
