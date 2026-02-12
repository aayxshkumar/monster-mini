"use client";

import { StickerLayer } from "@/components/sticker-layer";
import type { Sticker } from "@/store/booth-store";

interface StickersOverlayProps {
  stickers: Sticker[];
  onUpdate: (id: string, updates: Partial<Sticker>) => void;
  onRemove: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function StickersOverlay({ stickers, onUpdate, onRemove, containerRef }: StickersOverlayProps) {
  if (stickers.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {stickers.map((s) => (
        <StickerLayer
          key={s.id}
          sticker={s}
          onUpdate={onUpdate}
          onRemove={onRemove}
          containerRef={containerRef}
        />
      ))}
    </div>
  );
}
