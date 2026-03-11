"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { ReceiptCanvas, type ReceiptCanvasHandle } from "@/components/receipt-canvas";
import { useBoothStore } from "@/store/booth-store";
import { api } from "@/lib/api";
import { enqueueUpload, SHARE_SHORT_URL } from "@/lib/share-upload";
import { compressForUpload } from "@/lib/image-compress";
import { generateShortCode } from "@/lib/short-code";
import { nanoid } from "nanoid";
import { Camera, RotateCcw, Printer, Loader2, Sparkles } from "lucide-react";

type KioskStage = "idle" | "countdown" | "preview" | "printing" | "done";

const BRIGHTNESS_PRESETS = [
  { value: "medium", contrast: 1.3, brightness: 1.25 },
  { value: "high", contrast: 1.5, brightness: 1.4 },
];

const COUNTDOWN_SECONDS = 3;
const DONE_RESET_SECONDS = 12;
const CANVAS_SETTLE_MS = 600;

export default function KioskPage() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;

  useEffect(() => {
    useBoothStore.getState().setCafeSlug(cafeSlug);
  }, [cafeSlug]);

  const [stage, setStage] = useState<KioskStage>("idle");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [printQrUrl, setPrintQrUrl] = useState<string | null>(null);
  const [doneCountdown, setDoneCountdown] = useState(DONE_RESET_SECONDS);
  const [piOnline, setPiOnline] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [canvasReady, setCanvasReady] = useState(false);

  const canvasRef = useRef<ReceiptCanvasHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doneTimerRef = useRef<NodeJS.Timeout | null>(null);

  const headerText = useBoothStore((s) => s.headerText);
  const logoPreview = useBoothStore((s) => s.logoPreview);

  // ── Pi health polling ───────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.health();
        const ok = h.status === "ok";
        setPiOnline(ok);
        useBoothStore.getState().setPiStatus(ok, h.camera, h.printer_ready ?? h.printer);
      } catch {
        setPiOnline(false);
        useBoothStore.getState().setPiStatus(false, false, false);
      }
    };
    check();
    const interval = setInterval(check, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Camera management ───────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraReady(false);
    }
  }, [cameraFacing]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const captureFrame = useCallback(async (): Promise<{ blob: Blob; url: string } | null> => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    const maxDim = 1200;
    const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (cameraFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          resolve({ blob, url: URL.createObjectURL(blob) });
        },
        "image/jpeg",
        0.92,
      );
    });
  }, [cameraFacing]);

  // ── Start camera when entering idle ─────────────────
  useEffect(() => {
    if (stage === "idle" || stage === "countdown") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {};
  }, [stage, startCamera, stopCamera]);

  // ── Fullscreen on mount ─────────────────────────────
  useEffect(() => {
    const enter = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    };
    enter();
  }, []);

  // ── Capture photo ───────────────────────────────────
  const doCapture = useCallback(async () => {
    const result = await captureFrame();
    if (!result) {
      setStage("idle");
      return;
    }
    setCapturedPhotoUrl(result.url);

    const uploaded = await api.uploadPhoto(result.blob).catch(() => null);
    const serverUrl = uploaded ? api.imageUrl(uploaded.filename) : result.url;
    const filename = uploaded?.filename ?? "";

    useBoothStore.getState().setPhoto(serverUrl, filename);
    useBoothStore.getState().setPhotoOriginal(result.url);

    const shortCode = generateShortCode();
    const photoId = nanoid();
    setPrintQrUrl(`${SHARE_SHORT_URL}/${cafeSlug}/s/${shortCode}`);

    if (SHARE_SHORT_URL) {
      useBoothStore.getState().setQrUrl(`${SHARE_SHORT_URL}/${cafeSlug}/s/${shortCode}`);
      useBoothStore.getState().setQrEnabled(true);
    }

    // stash for print time
    (window as unknown as Record<string, unknown>).__kioskShareMeta = { photoId, shortCode };

    stopCamera();
    setCanvasReady(false);
    setStage("preview");

    setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
  }, [captureFrame, stopCamera]);

  // ── Countdown timer ─────────────────────────────────
  const startCountdown = useCallback(() => {
    setStage("countdown");
    setCount(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        doCapture();
      } else {
        setCount(remaining);
      }
    }, 1000);
  }, [doCapture]);

  // ── Retake ──────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedPhotoUrl(null);
    setPrintQrUrl(null);
    setCanvasReady(false);
    setStage("idle");
  }, []);

  // ── Print ───────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    setStage("printing");

    try {
      await new Promise((r) => setTimeout(r, 200));
      const blob = await canvasRef.current?.exportImage();
      if (!blob) throw new Error("Canvas export failed");

      const s = useBoothStore.getState();
      const preset = BRIGHTNESS_PRESETS.find((p) => p.value === s.printBrightness) || BRIGHTNESS_PRESETS[1];
      const jobId = `kiosk_${Date.now()}`;

      useBoothStore.getState().addPrintJob(jobId);
      const res = await api.printImage(blob, jobId, {
        algorithm: s.algorithm,
        contrast: preset.contrast,
        brightness: preset.brightness,
      });
      if (res.error) throw new Error(res.error);
      useBoothStore.getState().updatePrintJob(jobId, "printing");

      api.saveToGallery(blob, "print").catch(() => {});

      const meta = (window as unknown as Record<string, unknown>).__kioskShareMeta as
        | { photoId: string; shortCode: string }
        | undefined;
      if (meta && SHARE_SHORT_URL) {
        compressForUpload(blob)
          .then((c) => enqueueUpload(meta.photoId, meta.shortCode, c.original, c.thumbnail, c.social, null, cafeSlug))
          .catch(() => {});
      }

      setStage("done");
    } catch {
      setStage("preview");
    }
  }, []);

  // ── Done screen auto-reset ──────────────────────────
  useEffect(() => {
    if (stage !== "done") return;
    setDoneCountdown(DONE_RESET_SECONDS);
    let remaining = DONE_RESET_SECONDS;
    doneTimerRef.current = setInterval(() => {
      remaining--;
      setDoneCountdown(remaining);
      if (remaining <= 0) {
        if (doneTimerRef.current) clearInterval(doneTimerRef.current);
        resetToIdle();
      }
    }, 1000);
    return () => {
      if (doneTimerRef.current) clearInterval(doneTimerRef.current);
    };
  }, [stage]);

  const resetToIdle = useCallback(() => {
    setCapturedPhotoUrl(null);
    setPrintQrUrl(null);
    setCanvasReady(false);
    useBoothStore.getState().setPhoto("", "");
    setStage("idle");
  }, []);

  // ── Cleanup on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (doneTimerRef.current) clearInterval(doneTimerRef.current);
    };
  }, [stopCamera]);

  // ── Toggle camera facing ────────────────────────────
  const toggleCamera = useCallback(() => {
    setCameraFacing((f) => (f === "user" ? "environment" : "user"));
  }, []);

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden select-none">
      {/* Hidden receipt canvas for export */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <ReceiptCanvas ref={canvasRef} />
      </div>

      {/* ── IDLE: Start Screen ─────────────────────── */}
      {stage === "idle" && (
        <div className="flex flex-col items-center justify-between h-full py-8">
          {/* Branding */}
          <div className="flex flex-col items-center gap-3 pt-8">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Cafe Logo"
                className="h-20 w-auto object-contain rounded-lg"
              />
            )}
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {headerText || "Archivio Photo Booth"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`inline-block h-2 w-2 rounded-full ${piOnline ? "bg-green-500" : "bg-red-400"}`} />
              {piOnline ? "Ready to print" : "Printer offline"}
            </div>
          </div>

          {/* Camera preview + capture button */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-xl px-6">
            <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-muted border-2 border-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <button
                onClick={toggleCamera}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={startCountdown}
              disabled={!cameraReady}
              className="group relative flex items-center justify-center gap-3 px-12 py-5 rounded-2xl gradient-warm text-white text-xl font-bold tracking-wide shadow-lg hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Camera className="h-7 w-7" />
              Take Photo
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          {/* Footer hint */}
          <p className="text-xs text-muted-foreground/60 pb-4 font-mono">
            Tap the button to start
          </p>
        </div>
      )}

      {/* ── COUNTDOWN ──────────────────────────────── */}
      {stage === "countdown" && (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="relative w-full max-w-xl aspect-4/3 mx-auto rounded-2xl overflow-hidden bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span
                key={count}
                className="text-[12rem] font-black text-white drop-shadow-2xl animate-in zoom-in-50 duration-500"
              >
                {count}
              </span>
            </div>
          </div>
          <p className="mt-6 text-lg text-muted-foreground font-medium">
            Hold still and smile!
          </p>
        </div>
      )}

      {/* ── PREVIEW ────────────────────────────────── */}
      {stage === "preview" && (
        <div className="flex flex-col items-center justify-between h-full py-6">
          <h2 className="text-2xl font-bold text-foreground pt-4">
            Looking good!
          </h2>

          <div className="flex-1 flex items-center justify-center w-full px-6 py-4 overflow-hidden">
            {capturedPhotoUrl && (
              <img
                src={capturedPhotoUrl}
                alt="Captured photo"
                className="max-h-full max-w-full object-contain rounded-2xl border-2 border-border shadow-md"
              />
            )}
          </div>

          <div className="flex items-center gap-4 pb-6">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-border bg-card text-foreground text-lg font-semibold hover:bg-muted active:scale-[0.97] transition-all"
            >
              <RotateCcw className="h-5 w-5" />
              Retake
            </button>
            <button
              onClick={handlePrint}
              disabled={!piOnline || !canvasReady}
              className="flex items-center gap-2 px-10 py-4 rounded-xl gradient-warm text-white text-lg font-bold shadow-lg hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Printer className="h-5 w-5" />
              {canvasReady ? "Print!" : "Preparing..."}
            </button>
          </div>
        </div>
      )}

      {/* ── PRINTING ───────────────────────────────── */}
      {stage === "printing" && (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <h2 className="text-3xl font-bold text-foreground">
            Printing your photo...
          </h2>
          <p className="text-muted-foreground">
            Hang tight, this will only take a moment
          </p>
        </div>
      )}

      {/* ── DONE ───────────────────────────────────── */}
      {stage === "done" && (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
          <div className="text-6xl">&#x2728;</div>
          <h2 className="text-3xl font-bold text-foreground">
            Your photo is printing!
          </h2>
          {printQrUrl && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg text-muted-foreground">
                Scan the QR code on your receipt to save and share your photo
              </p>
              <p className="text-xs font-mono text-muted-foreground/60 mt-1">
                {printQrUrl}
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={resetToIdle}
              className="px-8 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted active:scale-[0.97] transition-all"
            >
              Take Another Photo
            </button>
            <p className="text-sm text-muted-foreground/60">
              Auto-resetting in {doneCountdown}s
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
