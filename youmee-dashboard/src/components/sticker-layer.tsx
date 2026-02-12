"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import type { Sticker } from "@/store/booth-store";

interface StickerLayerProps {
  sticker: Sticker;
  onUpdate: (id: string, updates: Partial<Sticker>) => void;
  onRemove: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function StickerLayer({ sticker, onUpdate, onRemove, containerRef }: StickerLayerProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, y: 0, sx: 0, sy: 0, sw: 0, sh: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY, sx: sticker.x, sy: sticker.y, sw: sticker.width, sh: sticker.height };
    },
    [sticker]
  );

  const handleResizeDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);
      startRef.current = { x: e.clientX, y: e.clientY, sx: sticker.x, sy: sticker.y, sw: sticker.width, sh: sticker.height };
    },
    [sticker]
  );

  useEffect(() => {
    if (!dragging && !resizing) return;
    const handleMove = (e: MouseEvent) => {
      const { x, y, sx, sy, sw, sh } = startRef.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;

      // Get container bounds for clamping (allow sticker to go slightly beyond — the bleed zone)
      const container = containerRef.current;
      const bleed = 40; // px of bleed beyond container edge

      if (dragging) {
        let newX = sx + dx;
        let newY = sy + dy;

        // Constrain to container + bleed zone
        if (container) {
          const cw = container.offsetWidth;
          const ch = container.offsetHeight;
          newX = Math.max(-bleed, Math.min(cw + bleed - sw, newX));
          newY = Math.max(-bleed, Math.min(ch + bleed - sh, newY));
        }

        onUpdate(sticker.id, { x: newX, y: newY });
      } else if (resizing) {
        const newW = Math.max(20, sw + dx);
        const newH = Math.max(20, sh + dy);
        onUpdate(sticker.id, { width: newW, height: newH });
      }
    };
    const handleUp = () => {
      setDragging(false);
      setResizing(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, resizing, sticker.id, onUpdate, containerRef]);

  return (
    <div
      className="group absolute pointer-events-auto"
      style={{
        left: sticker.x,
        top: sticker.y,
        width: sticker.width,
        height: sticker.height,
      }}
    >
      {/* Drag handle (full sticker area) — image fills box completely */}
      <div
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <img
          src={sticker.src}
          alt=""
          className="h-full w-full"
          style={{ objectFit: "fill" }}
          draggable={false}
        />
      </div>

      {/* Delete button — pinned to top-right corner of the container */}
      <button
        onClick={() => onRemove(sticker.id)}
        className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 z-10 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "rgba(0,0,0,0.8)", color: "white" }}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Resize handle — pinned to bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2 z-10 h-3 w-3 cursor-se-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 shadow-sm"
        style={{ background: "white", border: "2px solid rgba(120,120,120,0.5)" }}
        onMouseDown={handleResizeDown}
      />

      {/* Selection border on hover */}
      <div className="absolute inset-0 rounded-sm border border-transparent group-hover:border-blue-400/50 pointer-events-none" />
    </div>
  );
}
