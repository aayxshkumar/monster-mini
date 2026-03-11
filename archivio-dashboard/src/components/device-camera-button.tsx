"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Smartphone, Camera, Loader2 } from "lucide-react";
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

const MAX_CAPTURE_SIZE = 800; // max px on longest side

export function DeviceCameraButton({ onCapture }: DeviceCameraButtonProps) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const [capturing, setCapturing] = useState(false);
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
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const handleOpen = () => {
    setOpen(true);
    setTimeout(startCamera, 100);
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setOpen(false);
    setError("");
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    setCapturing(true);
    const video = videoRef.current;

    // Full-size capture canvas
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    const fullCtx = fullCanvas.getContext("2d")!;

    // Mirror the capture (front camera is mirrored in preview)
    fullCtx.translate(fullCanvas.width, 0);
    fullCtx.scale(-1, 1);
    fullCtx.drawImage(video, 0, 0);

    // Resize to max MAX_CAPTURE_SIZE on longest side
    let outW = fullCanvas.width;
    let outH = fullCanvas.height;
    if (Math.max(outW, outH) > MAX_CAPTURE_SIZE) {
      const scale = MAX_CAPTURE_SIZE / Math.max(outW, outH);
      outW = Math.round(outW * scale);
      outH = Math.round(outH * scale);
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext("2d")!;
    outCtx.drawImage(fullCanvas, 0, 0, outW, outH);

    outCanvas.toBlob((blob) => {
      if (blob) {
        // Stop camera BEFORE creating URL and calling callback
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
        
        const url = URL.createObjectURL(blob);
        onCapture(blob, url);
        setOpen(false);
        setError("");
        setCapturing(false);
      }
    }, "image/jpeg", 0.85);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="w-full gap-2 border-dashed">
        <Smartphone className="h-4 w-4" />
        Take photo from this device
      </Button>

      <Dialog open={open} onOpenChange={(o) => { 
        if (!o) {
          // Always stop camera when dialog closes (backdrop, ESC, X button)
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            setStream(null);
          }
          setOpen(false);
          setError("");
        }
      }}>
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
                style={{ transform: "scaleX(-1)" }}
                onLoadedMetadata={() => videoRef.current?.play()}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={capturing}>Cancel</Button>
            <Button onClick={handleCapture} disabled={!stream || capturing} className="gap-2">
              {capturing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Capturing...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" /> Capture
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
