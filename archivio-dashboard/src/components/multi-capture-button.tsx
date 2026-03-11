"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Smartphone, Loader2, Timer, ImageIcon, Layers, SplitSquareVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { toast } from "sonner";

const MAX_CAPTURE_SIZE = 800;

interface MultiCaptureButtonProps {
  /** How many photos to capture */
  count: number;
  onCountChange: (n: number) => void;
  /** "separate" = each photo printed individually; "single" = all on one strip */
  layout: "separate" | "single";
  onLayoutChange: (layout: "separate" | "single") => void;
  /** Called for each captured photo (blob + url) */
  onCapture: (blob: Blob, url: string) => void;
  /** Called with all captured blobs when session finishes */
  onSessionComplete: (photos: { blob: Blob; url: string }[]) => void;
  /** Whether Pi camera is available */
  piCameraAvailable: boolean;
}

type CaptureSource = "device" | "pi";

export function MultiCaptureButton({
  count,
  onCountChange,
  layout,
  onLayoutChange,
  onCapture,
  onSessionComplete,
  piCameraAvailable,
}: MultiCaptureButtonProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<CaptureSource>("device");
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentShot, setCurrentShot] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  // Start device camera
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

  // Cleanup camera on unmount ONLY
  useEffect(() => {
    return () => {
      // This cleanup only runs when component unmounts
      const currentStream = stream;
      const currentPhotos = capturedPhotos;
      const currentCountdown = countdownRef.current;
      
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
      if (currentCountdown) {
        clearInterval(currentCountdown);
      }
      currentPhotos.forEach(p => {
        if (p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = only on unmount

  // Capture one frame from the device camera
  const captureDeviceFrame = useCallback((): Promise<{ blob: Blob; url: string } | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) { resolve(null); return; }
      const video = videoRef.current;

      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = video.videoWidth;
      fullCanvas.height = video.videoHeight;
      const fullCtx = fullCanvas.getContext("2d")!;
      fullCtx.translate(fullCanvas.width, 0);
      fullCtx.scale(-1, 1);
      fullCtx.drawImage(video, 0, 0);

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
          const url = URL.createObjectURL(blob);
          resolve({ blob, url });
        } else {
          resolve(null);
        }
      }, "image/jpeg", 0.85);
    });
  }, []);

  // Capture from Pi camera
  const capturePiFrame = useCallback(async (): Promise<{ blob: Blob; url: string } | null> => {
    try {
      const result = await api.capturePhoto();
      const url = api.imageUrl(result.filename);
      // Fetch the image as blob for consistency
      const res = await fetch(url);
      const blob = await res.blob();
      return { blob, url };
    } catch {
      return null;
    }
  }, []);

  // Run countdown (3 seconds) then capture
  const runCountdownAndCapture = useCallback(async (shotIndex: number): Promise<{ blob: Blob; url: string } | null> => {
    return new Promise((resolve) => {
      let remaining = 3;
      setCountdown(remaining);

      countdownRef.current = setInterval(() => {
        // Check abort flag
        if (abortRef.current) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setCountdown(null);
          resolve(null);
          return;
        }

        remaining -= 1;
        if (remaining <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setCountdown(null);
          
          // Check abort one more time before capture
          if (abortRef.current) {
            resolve(null);
            return;
          }
          
          // Capture now
          if (source === "device") {
            captureDeviceFrame().then(resolve);
          } else {
            capturePiFrame().then(resolve);
          }
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    });
  }, [source, captureDeviceFrame, capturePiFrame]);

  // Start the multi-capture session
  const startSession = useCallback(async () => {
    setCapturing(true);
    setCapturedPhotos([]);
    setCurrentShot(0);
    abortRef.current = false;

    const photos: { blob: Blob; url: string }[] = [];

    for (let i = 0; i < count; i++) {
      if (abortRef.current) {
        toast.info("Capture aborted");
        break;
      }

      setCurrentShot(i + 1);
      const photo = await runCountdownAndCapture(i);

      if (abortRef.current) {
        toast.info("Capture aborted");
        break;
      }

      if (photo) {
        photos.push(photo);
        setCapturedPhotos([...photos]);
        onCapture(photo.blob, photo.url);
        toast.success(`Photo ${i + 1}/${count} captured!`);
      } else {
        if (!abortRef.current) {
          toast.error(`Photo ${i + 1} failed, skipping...`);
        }
      }

      // Small pause between shots
      if (i < count - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setCapturing(false);
    setCurrentShot(0);
    setCountdown(null);

    // Stop camera after session completes
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    if (photos.length > 0 && !abortRef.current) {
      onSessionComplete(photos);
      toast.success(`Multi-capture complete! ${photos.length} photos taken.`);
      // Close dialog after successful completion
      setTimeout(() => setOpen(false), 500);
    } else if (photos.length > 0 && abortRef.current) {
      onSessionComplete(photos);
      toast.info(`Captured ${photos.length} of ${count} photos before abort.`);
    }
  }, [count, runCountdownAndCapture, onCapture, onSessionComplete, stream]);

  const handleOpen = () => {
    setOpen(true);
    setCapturedPhotos([]);
    setCapturing(false);
    setCurrentShot(0);
    setCountdown(null);
    setError("");
    abortRef.current = false;
    if (source === "device") {
      setTimeout(startCamera, 100);
    }
  };

  const handleClose = () => {
    abortRef.current = true;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    // Stop camera immediately
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setOpen(false);
    setCapturing(false);
    setCountdown(null);
    setError("");
  };

  // Handle camera when switching sources or opening dialog
  useEffect(() => {
    if (!open) return;
    
    if (source === "device") {
      if (!stream && !capturing) {
        // Start device camera if not already running and not capturing
        startCamera();
      }
    } else if (source === "pi" && stream) {
      // Switching TO Pi camera - stop device camera
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, open, capturing]);

  return (
    <>
      {/* Settings row: count + layout */}
      <div className="space-y-2 rounded-lg border border-dashed p-2.5">
        <div className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Label className="text-xs text-muted-foreground shrink-0">Multi-capture</Label>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(count)} onValueChange={(v) => onCountChange(Number(v))}>
            <SelectTrigger className="h-7 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n} {n === 1 ? "photo" : "photos"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {count > 1 && (
            <ToggleGroup
              type="single"
              value={layout}
              onValueChange={(v) => { if (v) onLayoutChange(v as "separate" | "single"); }}
              size="sm"
              className="flex-1"
            >
              <ToggleGroupItem value="separate" className="text-[10px] px-2 h-7 flex-1 gap-1">
                <SplitSquareVertical className="h-3 w-3" />
                Separate
              </ToggleGroupItem>
              <ToggleGroupItem value="single" className="text-[10px] px-2 h-7 flex-1 gap-1">
                <Layers className="h-3 w-3" />
                One strip
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {count > 1 && (
          <p className="text-[10px] text-muted-foreground">
            {layout === "separate"
              ? "Each photo prints as a separate receipt."
              : "All photos combined on one receipt strip."}
          </p>
        )}

        {count > 1 && (
          <Button variant="outline" size="sm" onClick={handleOpen} className="w-full gap-2 border-dashed text-xs h-8">
            <Camera className="h-3.5 w-3.5" />
            Start {count}-photo session (3s countdown each)
          </Button>
        )}
      </div>

      {/* Multi-capture dialog */}
      <Dialog open={open} onOpenChange={(o) => { 
        if (!o) {
          // Always stop camera when dialog closes
          abortRef.current = true;
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            setStream(null);
          }
          setOpen(false);
          setCapturing(false);
          setCountdown(null);
          setError("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Multi-Capture — {count} Photos
            </DialogTitle>
          </DialogHeader>

          {/* Camera source toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Source:</Label>
            <ToggleGroup
              type="single"
              value={source}
              onValueChange={(v) => { if (v) setSource(v as CaptureSource); }}
              size="sm"
            >
              <ToggleGroupItem value="device" className="text-xs px-3 h-7 gap-1" disabled={capturing}>
                <Smartphone className="h-3 w-3" /> Device
              </ToggleGroupItem>
              <ToggleGroupItem value="pi" className="text-xs px-3 h-7 gap-1" disabled={!piCameraAvailable || capturing}>
                <Camera className="h-3 w-3" /> Pi
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Camera viewfinder */}
          {source === "device" ? (
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
              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-7xl font-bold text-white animate-pulse">{countdown}</span>
                </div>
              )}
              {/* Shot indicator */}
              {capturing && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-black/60 text-white border-none text-xs">
                    Shot {currentShot}/{count}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg bg-muted aspect-[4/3] flex items-center justify-center">
              <div className="text-center space-y-2">
                <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pi camera will capture remotely</p>
              </div>
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-7xl font-bold text-white animate-pulse">{countdown}</span>
                </div>
              )}
              {capturing && (
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-black/60 text-white border-none text-xs">
                    Shot {currentShot}/{count}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {capturing && (
            <div className="space-y-1">
              <Progress value={(capturedPhotos.length / count) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {capturedPhotos.length} of {count} captured
              </p>
            </div>
          )}

          {/* Captured thumbnails */}
          {capturedPhotos.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {capturedPhotos.map((p, i) => (
                <img
                  key={i}
                  src={p.url}
                  alt={`Capture ${i + 1}`}
                  className="h-12 w-12 rounded object-cover border"
                />
              ))}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleClose}>
              {capturing ? "Abort" : "Close"}
            </Button>
            {!capturing && capturedPhotos.length === 0 && (
              <Button onClick={startSession} disabled={source === "device" && !stream} className="gap-2">
                <Camera className="h-4 w-4" />
                Start Capture
              </Button>
            )}
            {!capturing && capturedPhotos.length > 0 && capturedPhotos.length < count && (
              <Button onClick={startSession} className="gap-2">
                <Camera className="h-4 w-4" />
                Retry All
              </Button>
            )}
            {!capturing && capturedPhotos.length === count && (
              <Button onClick={handleClose} className="gap-2">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
