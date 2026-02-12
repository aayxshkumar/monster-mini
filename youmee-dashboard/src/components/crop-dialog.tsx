"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, MediaSize } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw } from "lucide-react";
import { getCroppedImg } from "@/lib/crop-utils";

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  aspect?: number;
  onCropComplete: (croppedBlob: Blob, croppedUrl: string) => void;
}

export function CropDialog({ open, onOpenChange, imageSrc, aspect, onCropComplete }: CropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(0.5);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  // When media loads, calculate minZoom so full image fits inside crop area
  const handleMediaLoaded = useCallback((mediaSize: MediaSize) => {
    // Allow zooming out enough to see the entire image
    const computed = Math.min(0.5, 1);
    setMinZoom(computed);
    // Start at zoom 1 — react-easy-crop shows full image by default with objectFit contain
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }, []);

  const handleApply = async () => {
    if (!croppedArea) return;
    const blob = await getCroppedImg(imageSrc, croppedArea, rotation);
    const url = URL.createObjectURL(blob);
    onCropComplete(blob, url);
    onOpenChange(false);
  };

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setRotation(0);
      setCroppedArea(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop & Adjust</DialogTitle>
        </DialogHeader>
        <div className="relative h-80 w-full overflow-hidden rounded-lg bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            rotation={rotation}
            aspect={aspect}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            onMediaLoaded={handleMediaLoaded}
            showGrid={true}
          />
        </div>
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <Label className="w-14 text-xs text-muted-foreground">Zoom</Label>
            <Slider
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              min={minZoom}
              max={4}
              step={0.02}
              className="flex-1"
            />
            <span className="w-10 text-right text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <Label className="w-14 text-xs text-muted-foreground">Rotate</Label>
            <Slider
              value={[rotation]}
              onValueChange={([v]) => setRotation(v)}
              min={0}
              max={360}
              step={1}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply}>Apply Crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
