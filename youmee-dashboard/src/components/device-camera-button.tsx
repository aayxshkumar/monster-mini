"use client";

import { useState, useRef, useCallback } from "react";
import { Smartphone, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeviceCameraButtonProps {
  onCapture: (blob: Blob, url: string) => void;
}

export function DeviceCameraButton({ onCapture }: DeviceCameraButtonProps) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch {
      setError("Camera permission denied or unavailable.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(startCamera, 100);
  };

  const handleClose = () => {
    stopCamera();
    setOpen(false);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        onCapture(blob, url);
        handleClose();
      }
    }, "image/jpeg", 0.92);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="w-full gap-2 border-dashed">
        <Smartphone className="h-4 w-4" />
        Take photo from this device
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Device Camera</DialogTitle>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
            {error ? (
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                {error}
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                onLoadedMetadata={() => videoRef.current?.play()}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleCapture} disabled={!stream} className="gap-2">
              <Camera className="h-4 w-4" /> Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
