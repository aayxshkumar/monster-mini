"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useBoothStore, type GridPhoto } from "@/store/booth-store";
import { GRID_LAYOUTS, getLayoutsForCount } from "@/lib/grid-layouts";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Shuffle, Plus, X, Layers, Loader2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function PhotoGridEditor() {
  const gridPhotos = useBoothStore((s) => s.gridPhotos);
  const gridLayout = useBoothStore((s) => s.gridLayout);
  const gridCanvasMode = useBoothStore((s) => s.gridCanvasMode);
  const addGridPhoto = useBoothStore((s) => s.addGridPhoto);
  const removeGridPhoto = useBoothStore((s) => s.removeGridPhoto);
  const shuffleGridLayout = useBoothStore((s) => s.shuffleGridLayout);
  const setGridCanvasMode = useBoothStore((s) => s.setGridCanvasMode);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        const id = `grid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const preview = URL.createObjectURL(file);
        
        // Add photo immediately with uploading status
        const gp: GridPhoto = { 
          id, 
          preview, 
          filename: "", 
          cropData: null,
          uploadStatus: "uploading"
        };
        addGridPhoto(gp);
        
        // Upload in background
        try {
          const res = await api.uploadPhoto(file);
          useBoothStore.getState().updateGridPhoto(id, {
            filename: res.filename,
            uploadStatus: "uploaded"
          });
        } catch {
          useBoothStore.getState().updateGridPhoto(id, {
            uploadStatus: "local"
          });
        }
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
            
            {/* Upload status indicator */}
            {photo.uploadStatus === "uploading" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              </div>
            )}
            {photo.uploadStatus === "local" && (
              <div className="absolute bottom-0 right-0 bg-yellow-500 rounded-tl px-1">
                <span className="text-[8px] text-white font-medium">Local</span>
              </div>
            )}
            {photo.uploadStatus === "uploaded" && (
              <div className="absolute bottom-0 right-0 bg-green-500 rounded-tl p-0.5">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}
            
            <button
              onClick={() => removeGridPhoto(photo.id)}
              className="absolute -top-1 -right-1 rounded-full bg-black/80 p-0.5 text-white opacity-0 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {count < 10 && (
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
                    className="h-full w-full rounded-sm object-contain bg-muted/30"
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

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startRef.current = { mx: clientX, my: clientY, ox: x, oy: y };
  };

  useEffect(() => {
    if (!dragging) return;
    
    const onMove = (e: MouseEvent | TouchEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const dx = clientX - startRef.current.mx;
      const dy = clientY - startRef.current.my;
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
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    
    return () => { 
      window.removeEventListener("mousemove", onMove); 
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, photo.id, updatePos]);

  return (
    <div
      ref={containerRef}
      className="absolute cursor-grab active:cursor-grabbing rounded-sm overflow-hidden border-2 shadow-md transition-all"
      style={{ 
        left: `${x}%`, 
        top: `${y}%`, 
        width: `${w}%`, 
        height: `${h}%`, 
        zIndex: dragging ? 10 : 1,
        borderColor: dragging ? 'rgb(59 130 246)' : 'transparent',
        transform: dragging ? 'scale(1.05)' : 'scale(1)'
      }}
      onMouseDown={onDown}
      onTouchStart={onDown}
    >
      <img src={photo.preview} alt="" className="h-full w-full object-contain pointer-events-none bg-muted/30" draggable={false} />
    </div>
  );
}
