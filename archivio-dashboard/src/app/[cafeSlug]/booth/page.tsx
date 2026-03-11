"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type FormEvent,
} from "react";
import { useParams } from "next/navigation";
import {
  ReceiptCanvas,
  type ReceiptCanvasHandle,
} from "@/components/receipt-canvas";
import { useBoothStore } from "@/store/booth-store";
import { useCafeConfig, loadConfigFromPi } from "@/lib/cafe-config";
import { api } from "@/lib/api";
import { enqueueUpload, SHARE_SHORT_URL } from "@/lib/share-upload";
import { compressForUpload } from "@/lib/image-compress";
import { generateShortCode } from "@/lib/short-code";
import { nanoid } from "nanoid";
import {
  Camera,
  RotateCcw,
  Printer,
  Loader2,
  Sparkles,
  ChevronRight,
  Check,
  Image as ImageIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";

type BoothStage =
  | "welcome"
  | "photo"
  | "countdown"
  | "template"
  | "edit"
  | "printing"
  | "done";

const COUNTDOWN_SECONDS = 3;
const DONE_RESET_SECONDS = 15;
const CANVAS_SETTLE_MS = 600;

const BRIGHTNESS_PRESETS = [
  { value: "medium", contrast: 1.3, brightness: 1.25 },
  { value: "high", contrast: 1.5, brightness: 1.4 },
];

interface TemplateItem {
  id: string;
  name: string;
  thumbnail: string;
}

export default function BoothPage() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;

  useEffect(() => {
    useBoothStore.getState().setCafeSlug(cafeSlug);
  }, [cafeSlug]);

  const [stage, setStage] = useState<BoothStage>("welcome");
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [printQrUrl, setPrintQrUrl] = useState<string | null>(null);
  const [doneCountdown, setDoneCountdown] = useState(DONE_RESET_SECONDS);
  const [piOnline, setPiOnline] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );
  const [canvasReady, setCanvasReady] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  const canvasRef = useRef<ReceiptCanvasHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const doneTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cafeName = useCafeConfig((s) => s.cafeName);
  const can = useCafeConfig((s) => s.can);
  const logoPreview = useBoothStore((s) => s.logoPreview);
  const headerText = useBoothStore((s) => s.headerText);

  // ── Load cafe config from Pi ────────────────────────
  useEffect(() => {
    loadConfigFromPi().finally(() => setConfigLoaded(true));
  }, []);

  // ── Pi health polling ───────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.health();
        const ok = h.status === "ok";
        setPiOnline(ok);
        useBoothStore
          .getState()
          .setPiStatus(ok, h.camera, h.printer_ready ?? h.printer);
      } catch {
        setPiOnline(false);
        useBoothStore.getState().setPiStatus(false, false, false);
      }
    };
    check();
    const interval = setInterval(check, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Load templates from Pi ──────────────────────────
  useEffect(() => {
    api
      .listTemplates()
      .then((list) => setTemplates(list))
      .catch(() => {});
  }, []);

  // ── Camera management ───────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
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

  const captureFrame = useCallback(async (): Promise<{
    blob: Blob;
    url: string;
  } | null> => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    const maxDim = 1200;
    const scale = Math.min(
      maxDim / video.videoWidth,
      maxDim / video.videoHeight,
      1,
    );
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

  // ── Stage camera control ────────────────────────────
  useEffect(() => {
    if (stage === "photo" || stage === "countdown") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [stage, startCamera, stopCamera]);

  // ── Fullscreen on mount ─────────────────────────────
  useEffect(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
  }, []);

  // ── Capture photo ───────────────────────────────────
  const doCapture = useCallback(async () => {
    const result = await captureFrame();
    if (!result) {
      setStage("photo");
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
    setPrintQrUrl(`${SHARE_SHORT_URL}/${shortCode}`);

    if (SHARE_SHORT_URL) {
      useBoothStore.getState().setQrUrl(`${SHARE_SHORT_URL}/${cafeSlug}/s/${shortCode}`);
      useBoothStore.getState().setQrEnabled(true);
    }

    (window as unknown as Record<string, unknown>).__boothShareMeta = {
      photoId,
      shortCode,
    };

    stopCamera();
    setCanvasReady(false);

    if (templates.length > 0 && can("canSelectTemplate")) {
      setStage("template");
    } else {
      setStage("edit");
      setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
    }
  }, [captureFrame, stopCamera, templates.length, can]);

  // ── Countdown ───────────────────────────────────────
  const startCountdown = useCallback(() => {
    setStage("countdown");
    setCount(COUNTDOWN_SECONDS);
    let remaining = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        if (countdownTimerRef.current)
          clearInterval(countdownTimerRef.current);
        doCapture();
      } else {
        setCount(remaining);
      }
    }, 1000);
  }, [doCapture]);

  // ── Select template ─────────────────────────────────
  const handleSelectTemplate = useCallback(
    async (tplId: string) => {
      try {
        const tpl = await api.getTemplate(tplId);
        const parsed = JSON.parse(tpl.state);
        const elements = Array.isArray(parsed) ? parsed : parsed.elements ?? [];
        useBoothStore.getState().setActiveTemplate({
          id: tpl.id,
          name: tpl.name,
          elements,
          canvasH: parsed.canvasH ?? 500,
          backgroundSrc: parsed.backgroundSrc ?? null,
        });
      } catch {}
      setStage("edit");
      setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
    },
    [],
  );

  const handleSkipTemplate = useCallback(() => {
    useBoothStore.getState().setActiveTemplate(null);
    setStage("edit");
    setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
  }, []);

  // ── Print ───────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    setStage("printing");
    try {
      await new Promise((r) => setTimeout(r, 200));
      const blob = await canvasRef.current?.exportImage();
      if (!blob) throw new Error("Canvas export failed");

      const s = useBoothStore.getState();
      const preset =
        BRIGHTNESS_PRESETS.find((p) => p.value === s.printBrightness) ||
        BRIGHTNESS_PRESETS[1];
      const jobId = `booth_${Date.now()}`;

      useBoothStore.getState().addPrintJob(jobId);
      const res = await api.printImage(blob, jobId, {
        algorithm: s.algorithm,
        contrast: preset.contrast,
        brightness: preset.brightness,
      });
      if (res.error) throw new Error(res.error);
      useBoothStore.getState().updatePrintJob(jobId, "printing");

      api.saveToGallery(blob, "print").catch(() => {});

      const meta = (window as unknown as Record<string, unknown>)
        .__boothShareMeta as
        | { photoId: string; shortCode: string }
        | undefined;
      if (meta && SHARE_SHORT_URL) {
        compressForUpload(blob)
          .then((c) =>
            enqueueUpload(
              meta.photoId,
              meta.shortCode,
              c.original,
              c.thumbnail,
              c.social,
              null,
              cafeSlug,
            ),
          )
          .catch(() => {});
      }

      setStage("done");
    } catch {
      setStage("edit");
    }
  }, []);

  // ── Retake ──────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedPhotoUrl(null);
    setPrintQrUrl(null);
    setCanvasReady(false);
    useBoothStore.getState().setActiveTemplate(null);
    setStage("photo");
  }, []);

  // ── Reset to welcome ────────────────────────────────
  const resetToWelcome = useCallback(() => {
    setCapturedPhotoUrl(null);
    setPrintQrUrl(null);
    setCanvasReady(false);
    useBoothStore.getState().setPhoto("", "");
    useBoothStore.getState().setActiveTemplate(null);
    setStage("welcome");
  }, []);

  // ── Done auto-reset ─────────────────────────────────
  useEffect(() => {
    if (stage !== "done") return;
    setDoneCountdown(DONE_RESET_SECONDS);
    let remaining = DONE_RESET_SECONDS;
    doneTimerRef.current = setInterval(() => {
      remaining--;
      setDoneCountdown(remaining);
      if (remaining <= 0) {
        if (doneTimerRef.current) clearInterval(doneTimerRef.current);
        resetToWelcome();
      }
    }, 1000);
    return () => {
      if (doneTimerRef.current) clearInterval(doneTimerRef.current);
    };
  }, [stage, resetToWelcome]);

  // ── Cleanup ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (doneTimerRef.current) clearInterval(doneTimerRef.current);
    };
  }, [stopCamera]);

  const toggleCamera = useCallback(() => {
    setCameraFacing((f) => (f === "user" ? "environment" : "user"));
  }, []);

  const displayName = cafeName || headerText || "Photo Booth";

  const STAGE_STEPS: { key: BoothStage[]; label: string }[] = [
    { key: ["photo", "countdown"], label: "Photo" },
    { key: ["template"], label: "Style" },
    { key: ["edit"], label: "Preview" },
    { key: ["printing", "done"], label: "Print" },
  ];

  const currentStepIdx = STAGE_STEPS.findIndex((s) =>
    s.key.includes(stage),
  );

  const countdownProgress =
    stage === "countdown" ? ((COUNTDOWN_SECONDS - count) / COUNTDOWN_SECONDS) * 100 : 0;
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden select-none">
      {/* Hidden receipt canvas for export */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <ReceiptCanvas ref={canvasRef} />
      </div>

      {/* Step progress indicator (hidden on welcome) */}
      {stage !== "welcome" && (
        <div className="flex items-center justify-center gap-2 pt-4 pb-2 px-6">
          {STAGE_STEPS.map((step, i) => {
            const isActive = i === currentStepIdx;
            const isDone = i < currentStepIdx;
            return (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isActive
                          ? "bg-foreground text-background ring-4 ring-foreground/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium ${
                      isActive || isDone ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STAGE_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-8 sm:w-12 rounded-full transition-colors duration-300 -mt-4 ${
                      isDone ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── WELCOME ──────────────────────────────── */}
      {stage === "welcome" && (
        <div className="flex flex-col items-center justify-between h-full py-12 px-6">
          <div className="flex-1" />

          <div className="flex flex-col items-center gap-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="h-24 w-auto object-contain rounded-xl"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-amber-500/20">
                <Camera className="h-12 w-12 text-primary" />
              </div>
            )}
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-center text-foreground">
              {displayName}
            </h1>
            <p className="text-lg text-muted-foreground text-center max-w-xs">
              Take a photo, pick a style, and get your print in seconds
            </p>

            <div className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-1.5 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${piOnline ? "bg-green-500 animate-pulse" : "bg-red-400"}`}
              />
              <span className="text-muted-foreground">
                {piOnline ? "Printer ready" : "Printer offline"}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-end gap-4">
            <button
              onClick={() => setStage("photo")}
              className="booth-start-btn group relative flex items-center justify-center gap-3 px-16 py-6 rounded-2xl bg-foreground text-background text-2xl font-bold shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Camera className="h-7 w-7" />
              Start
              <ChevronRight className="h-6 w-6 opacity-50 group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="text-xs text-muted-foreground/50 pb-4">
              Tap to begin your photo booth experience
            </p>
          </div>
        </div>
      )}

      {/* ── PHOTO (camera viewfinder) ────────────── */}
      {(stage === "photo" || stage === "countdown") && (
        <div className="flex flex-col items-center justify-between flex-1 py-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
          <h2 className="text-xl font-bold text-foreground">
            {stage === "countdown" ? "Hold still!" : "Strike a pose"}
          </h2>

          <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-xl px-4">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-muted border-2 border-border shadow-lg">
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
              {stage === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <div className="relative flex items-center justify-center">
                    <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="4" />
                      <circle
                        cx="60" cy="60" r="54" fill="none" stroke="white" strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (countdownProgress / 100) * circumference}
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <span
                      key={count}
                      className="absolute text-8xl font-black text-white drop-shadow-2xl animate-in zoom-in-50 duration-300"
                    >
                      {count}
                    </span>
                  </div>
                </div>
              )}
              <button
                onClick={toggleCamera}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 pb-4">
            <button
              onClick={resetToWelcome}
              className="px-6 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold active:scale-[0.97] transition-all"
            >
              Back
            </button>
            {stage === "photo" && (
              <button
                onClick={startCountdown}
                disabled={!cameraReady}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-foreground text-background text-xl font-bold shadow-lg hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-40"
              >
                <Camera className="h-6 w-6" />
                Capture
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATE SELECTION ────────────────────── */}
      {stage === "template" && (
        <div className="flex flex-col flex-1 py-4 px-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-foreground">
              Choose a Style
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a template for your photo
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-border hover:border-primary/50 hover:shadow-lg transition-all bg-muted"
                >
                  {tpl.thumbnail ? (
                    <img
                      src={api.imageUrl(tpl.thumbnail)}
                      alt={tpl.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <span className="text-sm font-semibold text-white">
                      {tpl.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={handleRetake}
              className="px-6 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold active:scale-[0.97] transition-all"
            >
              Retake
            </button>
            <button
              onClick={handleSkipTemplate}
              className="px-8 py-3 rounded-xl bg-muted text-foreground font-semibold active:scale-[0.97] transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT (preview + controls) ────────────── */}
      {stage === "edit" && (
        <div className="flex flex-col items-center justify-between flex-1 py-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
          <h2 className="text-lg font-bold text-foreground">
            Preview your print
          </h2>

          <div className="flex-1 flex items-center justify-center w-full px-4 py-2 overflow-hidden">
            {capturedPhotoUrl && (
              <img
                src={capturedPhotoUrl}
                alt="Your photo"
                className="max-h-full max-w-full object-contain rounded-xl border-2 border-border shadow-lg"
              />
            )}
          </div>

          <div className="flex items-center gap-3 pb-4 px-4">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold active:scale-[0.97] transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </button>
            <button
              onClick={handlePrint}
              disabled={!piOnline || !canvasReady}
              className="flex items-center gap-2 px-10 py-4 rounded-xl bg-foreground text-background text-lg font-bold shadow-lg hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-40"
            >
              <Printer className="h-5 w-5" />
              {canvasReady ? "Print" : "Preparing..."}
            </button>
          </div>
        </div>
      )}

      {/* ── PRINTING ─────────────────────────────── */}
      {stage === "printing" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 animate-in fade-in-0 duration-300">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-card border-2 border-border">
              <Printer className="h-10 w-10 text-foreground animate-bounce" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground text-center">
            Printing your photo...
          </h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Hang tight, this will only take a moment
          </p>
        </div>
      )}

      {/* ── DONE ─────────────────────────────────── */}
      {stage === "done" && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-8 animate-in fade-in-0 zoom-in-95 duration-500">
          <div className="relative">
            <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-primary/30 to-amber-500/30 blur-xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-10 w-10" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Your photo is printing!
          </h2>
          {printQrUrl && (
            <p className="text-base text-muted-foreground max-w-xs">
              Scan the QR code on your receipt to save and share your photo
              digitally
            </p>
          )}

          <button
            onClick={resetToWelcome}
            className="mt-4 flex items-center gap-2 px-8 py-3 rounded-xl bg-foreground text-background font-bold shadow-lg hover:scale-[1.02] active:scale-[0.97] transition-all"
          >
            <Camera className="h-5 w-5" />
            Take Another Photo
          </button>
          <p className="text-sm text-muted-foreground/60">
            Auto-resetting in {doneCountdown}s
          </p>
        </div>
      )}
    </div>
  );
}
