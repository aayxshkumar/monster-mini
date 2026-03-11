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
import { RotateCw, Undo2 } from "lucide-react";
import { getCroppedImg } from "@/lib/crop-utils";

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always pass the ORIGINAL (uncropped) image here */
  imageSrc: string;
  aspect?: number;
  onCropComplete: (croppedBlob: Blob, croppedUrl: string) => void;
  /** Called when "Reset to original" is clicked */
  onReset?: () => void;
  /** Whether the image has been previously cropped (enables reset button) */
  isCropped?: boolean;
}

export function CropDialog({
  open,
  onOpenChange,
  imageSrc,
  aspect,
  onCropComplete,
  onReset,
  isCropped,
}: CropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(0.3);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleMediaLoaded = useCallback((_mediaSize: MediaSize) => {
    setMinZoom(0.3);
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
            maxZoom={5}
            rotation={rotation}
            aspect={aspect}
            objectFit="contain"
            restrictPosition={false}
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
              max={5}
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
        <DialogFooter className="flex flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {isCropped && onReset && (
              <Button
                variant="destructive"
                size="default"
                onClick={() => {
                  onReset();
                  onOpenChange(false);
                }}
                className="gap-1.5"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Reset to original
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button onClick={handleApply}>Apply Crop</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
