"use client";

import { Suspense, useEffect, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ImageDropzone } from "@/components/image-dropzone";
import { ReceiptCanvas, type ReceiptCanvasHandle } from "@/components/receipt-canvas";
import { CameraButton } from "@/components/camera-button";
import { DeviceCameraButton } from "@/components/device-camera-button";
import { PrintButton } from "@/components/print-button";
import { FontPicker } from "@/components/font-picker";
import { PhotoGridEditor } from "@/components/photo-grid-editor";
import { StickerPanel } from "@/components/sticker-panel";
import { PrintQueuePanel } from "@/components/print-queue-panel";
import { MultiCaptureButton } from "@/components/multi-capture-button";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { useBoothStore, type AspectRatio } from "@/store/booth-store";
import { useCafeConfig, initCafeConfigListener } from "@/lib/cafe-config";
import { api } from "@/lib/api";
import { BORDER_STYLES, type BorderStyle } from "@/lib/borders";
import { nanoid } from "nanoid";
import { generateShortCode } from "@/lib/short-code";
import { compressForUpload } from "@/lib/image-compress";
import { enqueueUpload, startShareUploadQueue, getShareServiceOnline, SHARE_SHORT_URL } from "@/lib/share-upload";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Wifi, WifiOff, Printer, Camera, RotateCw, Clock, CalendarDays, MapPin, Type, Sticker, LayoutTemplate, Layers, Copy, CameraIcon, GripVertical, Share2, Download, Save, Wand2, Image as ImageIcon } from "lucide-react";
import { InteractiveMenu, type InteractiveMenuItem } from "@/components/ui/modern-mobile-menu";
import { useSearchParams, useParams } from "next/navigation";
import { GOOGLE_FONTS, loadGoogleFont, preloadAllFonts } from "@/lib/fonts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

/** Small SVG thumbnail showing what a border style looks like */
function BorderPreview({ border }: { border: BorderStyle }) {
  const w = 36;
  const h = 22;
  const sw = Math.min(border.strokeWidth ?? 0, 3); // cap at 3 for preview
  const half = sw / 2;

  if (!border.stroke || border.strokeWidth === 0) {
    // No border — show a plain photo placeholder
    return (
      <span className="inline-flex items-center gap-2">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
          <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="#f0f0f0" stroke="#d0d0d0" strokeWidth={0.5} />
          <line x1={0.5} y1={0.5} x2={w - 0.5} y2={h - 0.5} stroke="#e0e0e0" strokeWidth={0.5} />
          <line x1={w - 0.5} y1={0.5} x2={0.5} y2={h - 0.5} stroke="#e0e0e0" strokeWidth={0.5} />
        </svg>
        {border.label}
      </span>
    );
  }

  if (border.id === "polaroid") {
    // White frame with extra space at bottom
    return (
      <span className="inline-flex items-center gap-2">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
          <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="#ffffff" stroke="#000" strokeWidth={0.5} />
          <rect x={2} y={2} width={w - 4} height={h - 7} fill="#e8e8e8" />
        </svg>
        {border.label}
      </span>
    );
  }

  if (border.id === "double") {
    // Two concentric rects
    return (
      <span className="inline-flex items-center gap-2">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
          <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="#f8f8f8" stroke="#000" strokeWidth={0.75} />
          <rect x={2.5} y={2.5} width={w - 5} height={h - 5} fill="none" stroke="#000" strokeWidth={0.75} />
        </svg>
        {border.label}
      </span>
    );
  }

  const dashAttr = border.dash && border.dash.some(d => d > 0) ? border.dash.map(d => d * 0.5).join(",") : undefined;
  const rx = border.cornerRadius ? Math.min(border.cornerRadius * 0.2, h / 2 - half - 0.5) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
        <rect x={half} y={half} width={w - sw} height={h - sw}
          fill="#f8f8f8"
          stroke={border.stroke}
          strokeWidth={sw}
          rx={rx}
          ry={rx}
          strokeDasharray={dashAttr}
        />
      </svg>
      {border.label}
    </span>
  );
}

const ALGORITHMS = [
  { value: "atkinson", label: "Film Grain", desc: "Classic aesthetic, retro Mac feel" },
  { value: "floyd_steinberg", label: "Fine Detail", desc: "Smooth gradients, natural photos" },
  { value: "stucki", label: "High Quality", desc: "Best for portraits, soft tones" },
  { value: "bayer8", label: "Newspaper", desc: "Bold crosshatch pattern, graphic" },
];

const BRIGHTNESS_PRESETS = [
  { value: "medium", label: "Medium", contrast: 1.3, brightness: 1.25 },
  { value: "high", label: "High", contrast: 1.5, brightness: 1.4 },
];

const SECTION_LABELS: Record<string, string> = {
  logo: "Logo",
  photo: "Photo",
  memo: "Memo",
  qr: "QR Code",
  stamp: "Stamp",
};

function SectionOrderList() {
  const sectionOrder = useBoothStore((s) => s.sectionOrder);
  const setSectionOrder = useBoothStore((s) => s.setSectionOrder);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null) return;
    if (draggedIndex === dropIndex) return;
    const next = [...sectionOrder];
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(dropIndex, 0, removed);
    setSectionOrder(next);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-1">
      {sectionOrder.map((id, index) => (
        <div
          key={id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(index)}
          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing ${draggedIndex === index ? "opacity-50" : ""}`}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{SECTION_LABELS[id] ?? id}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardWithSlug />
    </Suspense>
  );
}

function DashboardWithSlug() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;
  useEffect(() => {
    useBoothStore.getState().setCafeSlug(cafeSlug);
  }, [cafeSlug]);
  return <Dashboard cafeSlug={cafeSlug} />;
}

function Dashboard({ cafeSlug }: { cafeSlug: string }) {
  // Granular selectors — each subscribes only to the slice it needs,
  // so unrelated store updates do NOT re-render this component.
  const piConnected = useBoothStore((s) => s.piConnected);
  const printerAvailable = useBoothStore((s) => s.printerAvailable);
  const cameraAvailable = useBoothStore((s) => s.cameraAvailable);
  const headerHeight = useBoothStore((s) => s.headerHeight);
  const headerTextEnabled = useBoothStore((s) => s.headerTextEnabled);
  const headerText = useBoothStore((s) => s.headerText);
  const headerTextSize = useBoothStore((s) => s.headerTextSize);
  const headerTextBold = useBoothStore((s) => s.headerTextBold);
  const headerTextItalic = useBoothStore((s) => s.headerTextItalic);
  const headerTextUnderline = useBoothStore((s) => s.headerTextUnderline);
  const headerTextFont = useBoothStore((s) => s.headerTextFont);
  const logoPreview = useBoothStore((s) => s.logoPreview);
  const logoOriginalPreview = useBoothStore((s) => s.logoOriginalPreview);
  const photoMode = useBoothStore((s) => s.photoMode);
  const photoPreview = useBoothStore((s) => s.photoPreview);
  const photoOriginalPreview = useBoothStore((s) => s.photoOriginalPreview);
  const photoFilename = useBoothStore((s) => s.photoFilename);
  const photoAspectRatio = useBoothStore((s) => s.photoAspectRatio);
  const photoRotation = useBoothStore((s) => s.photoRotation);
  const photoFilter = useBoothStore((s) => s.photoFilter);
  const photoBorderId = useBoothStore((s) => s.photoBorderId);
  const gridPhotos = useBoothStore((s) => s.gridPhotos);
  const multiCaptureCount = useBoothStore((s) => s.multiCaptureCount);
  const multiCaptureLayout = useBoothStore((s) => s.multiCaptureLayout);
  const memo = useBoothStore((s) => s.memo);
  const savedMemos = useBoothStore((s) => s.savedMemos);
  const qrEnabled = useBoothStore((s) => s.qrEnabled);
  const qrUrl = useBoothStore((s) => s.qrUrl);
  const qrDestination = useBoothStore((s) => s.qrDestination);
  const qrSize = useBoothStore((s) => s.qrSize);
  const qrCaption = useBoothStore((s) => s.qrCaption);
  const showQrCaption = useBoothStore((s) => s.showQrCaption);
  const eventModeEnabled = useBoothStore((s) => s.eventModeEnabled);
  const eventName = useBoothStore((s) => s.eventName);
  const eventDate = useBoothStore((s) => s.eventDate);
  const eventLocation = useBoothStore((s) => s.eventLocation);
  const algorithm = useBoothStore((s) => s.algorithm);
  const printBrightness = useBoothStore((s) => s.printBrightness);
  const printCopies = useBoothStore((s) => s.printCopies);
  const dateStampEnabled = useBoothStore((s) => s.dateStampEnabled);
  const timeStampEnabled = useBoothStore((s) => s.timeStampEnabled);
  const locationStampEnabled = useBoothStore((s) => s.locationStampEnabled);
  const locationText = useBoothStore((s) => s.locationText);
  const dateFormat = useBoothStore((s) => s.dateFormat);
  const timeFormat = useBoothStore((s) => s.timeFormat);
  const stampEnabled = useBoothStore((s) => s.stampEnabled);
  const shareServiceOnline = useBoothStore((s) => s.shareServiceOnline);

  // Cafe config (feature flags + locked fields from platform)
  const can = useCafeConfig((s) => s.can);
  const isLocked = useCafeConfig((s) => s.isLocked);
  const embedded = useCafeConfig((s) => s.embedded);
  const cafeName = useCafeConfig((s) => s.cafeName);
  const maxCopies = useCafeConfig((s) => s.features.maxCopies);

  // Initialize cafe config listener for platform iframe integration
  useEffect(() => { initCafeConfigListener(); }, []);

  // Design mode detection (for template builder via platform iframe)
  const searchParams = useSearchParams();
  const isDesignMode = searchParams.get("mode") === "design";
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleSaveAsTemplate = useCallback(async () => {
    setSavingTemplate(true);
    try {
      const thumbnail = await canvasRef.current?.exportThumbnail(200);
      const state = useBoothStore.getState();
      const stateSnapshot = {
        headerText: state.headerText,
        headerTextEnabled: state.headerTextEnabled,
        headerTextFont: state.headerTextFont,
        headerTextSize: state.headerTextSize,
        headerTextBold: state.headerTextBold,
        headerTextItalic: state.headerTextItalic,
        headerHeight: state.headerHeight,
        logoPreview: state.logoPreview,
        logoFilename: state.logoFilename,
        logoCrop: state.logoCrop,
        photoMode: state.photoMode,
        gridLayout: state.gridLayout,
        gridCanvasMode: state.gridCanvasMode,
        photoBorderId: state.photoBorderId,
        photoFilter: state.photoFilter,
        photoAspectRatio: state.photoAspectRatio,
        algorithm: state.algorithm,
        printBrightness: state.printBrightness,
        memo: state.memo,
        memoFont: state.memoFont,
        memoFontSize: state.memoFontSize,
        qrEnabled: state.qrEnabled,
        qrUrl: state.qrUrl,
        qrSize: state.qrSize,
        qrCaption: state.qrCaption,
        showQrCaption: state.showQrCaption,
        qrDestination: state.qrDestination,
        dateStampEnabled: state.dateStampEnabled,
        dateFormat: state.dateFormat,
        timeStampEnabled: state.timeStampEnabled,
        timeFormat: state.timeFormat,
        locationStampEnabled: state.locationStampEnabled,
        locationText: state.locationText,
        sectionOrder: state.sectionOrder,
        eventModeEnabled: state.eventModeEnabled,
        eventName: state.eventName,
        eventDate: state.eventDate,
        eventLocation: state.eventLocation,
        printCopies: state.printCopies,
      };

      let thumbnailDataUrl: string | null = null;
      if (thumbnail) {
        const reader = new FileReader();
        thumbnailDataUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(thumbnail);
        });
      }

      window.parent.postMessage(
        {
          type: "archivio:save-template",
          payload: {
            state: JSON.stringify(stateSnapshot),
            thumbnail: thumbnailDataUrl,
          },
        },
        "*",
      );
    } finally {
      setSavingTemplate(false);
    }
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<ReceiptCanvasHandle>(null);
  const [stickerSheetOpen, setStickerSheetOpen] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const previewQrMetaRef = useRef<{ photoId: string; shortCode: string } | null>(null);

  // Template selector state
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; thumbnail: string }[]>([]);
  const activeTemplate = useBoothStore((s) => s.activeTemplate);
  const receiptHeightOverride = useBoothStore((s) => s.receiptHeightOverride);
  const receiptHeightSliderValue = useMemo(() => [receiptHeightOverride], [receiptHeightOverride]);

  // Fetch saved templates from Pi
  useEffect(() => {
    api.listTemplates().then(setSavedTemplates).catch(() => {});
  }, []);

  // Load a template and activate it — the receipt canvas renders its elements
  const applyTemplate = useCallback(async (tplId: string) => {
    try {
      const tpl = await api.getTemplate(tplId);
      const state = JSON.parse(tpl.state);
      // Template editor templates have `elements` array
      if (state.elements && Array.isArray(state.elements)) {
        useBoothStore.getState().setActiveTemplate({
          id: tplId,
          name: tpl.name,
          elements: state.elements,
          canvasH: state.canvasH || 500,
          backgroundSrc: state.backgroundSrc || null,
        });
        toast.success(`Template "${tpl.name}" loaded — add your photo below`);
      } else {
        toast.error("This template format is not supported in the dashboard");
      }
    } catch (err: unknown) {
      toast.error(`Failed to load template: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  const clearActiveTemplate = useCallback(() => {
    useBoothStore.getState().setActiveTemplate(null);
    toast.info("Template removed — back to freeform mode");
  }, []);

  // Save current dashboard state as template to Pi server
  const [savingDashboardTemplate, setSavingDashboardTemplate] = useState(false);
  const handleSaveDashboardAsTemplate = useCallback(async () => {
    setSavingDashboardTemplate(true);
    try {
      const thumbnail = await canvasRef.current?.exportThumbnail(200);
      const state = useBoothStore.getState();
      const stateSnapshot = {
        headerText: state.headerText,
        headerTextEnabled: state.headerTextEnabled,
        headerTextFont: state.headerTextFont,
        headerTextSize: state.headerTextSize,
        headerTextBold: state.headerTextBold,
        headerTextItalic: state.headerTextItalic,
        headerHeight: state.headerHeight,
        logoPreview: state.logoPreview,
        logoFilename: state.logoFilename,
        logoCrop: state.logoCrop,
        photoMode: state.photoMode,
        gridLayout: state.gridLayout,
        gridCanvasMode: state.gridCanvasMode,
        photoBorderId: state.photoBorderId,
        photoFilter: state.photoFilter,
        photoAspectRatio: state.photoAspectRatio,
        algorithm: state.algorithm,
        printBrightness: state.printBrightness,
        memo: state.memo,
        memoFont: state.memoFont,
        memoFontSize: state.memoFontSize,
        qrEnabled: state.qrEnabled,
        qrUrl: state.qrUrl,
        qrSize: state.qrSize,
        qrCaption: state.qrCaption,
        showQrCaption: state.showQrCaption,
        qrDestination: state.qrDestination,
        dateStampEnabled: state.dateStampEnabled,
        dateFormat: state.dateFormat,
        timeStampEnabled: state.timeStampEnabled,
        timeFormat: state.timeFormat,
        locationStampEnabled: state.locationStampEnabled,
        locationText: state.locationText,
        sectionOrder: state.sectionOrder,
        eventModeEnabled: state.eventModeEnabled,
        eventName: state.eventName,
        eventDate: state.eventDate,
        eventLocation: state.eventLocation,
        printCopies: state.printCopies,
      };
      let thumbnailFile = "";
      if (thumbnail) {
        try {
          const uploaded = await api.uploadThumbnail(thumbnail);
          thumbnailFile = uploaded.filename;
        } catch { /* skip */ }
      }
      const name = `Dashboard ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const result = await api.saveTemplate(name, JSON.stringify(stateSnapshot), thumbnailFile);
      const templates = await api.listTemplates();
      setSavedTemplates(templates);
      toast.success(`Template saved: ${name}`);
    } catch (err: unknown) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSavingDashboardTemplate(false);
    }
  }, []);

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.health();
        useBoothStore.getState().setPiStatus(h.status === "ok", h.camera, h.printer_ready ?? h.printer);
      } catch {
        useBoothStore.getState().setPiStatus(false, false, false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Share service queue + health
  useEffect(() => {
    startShareUploadQueue();
    const checkShare = async () => {
      const ok = await getShareServiceOnline();
      useBoothStore.getState().setShareServiceOnline(ok);
    };
    checkShare();
    const t = setInterval(checkShare, 30000);
    return () => clearInterval(t);
  }, []);

  // Poll print queue jobs + auto-remove completed after 8s
  useEffect(() => {
    const poll = () => {
      const currentQueue = useBoothStore.getState().printQueue;
      currentQueue
        .filter((j) => j.status === "pending" || j.status === "printing")
        .forEach(async (job) => {
          try {
            const res = await api.printStatus(job.id);
            // Ignore "unknown" — means the job hasn't reached the server yet (still uploading)
            if (res.status === "unknown") return;
            if (res.status !== job.status) {
              useBoothStore.getState().updatePrintJob(job.id, res.status as "printing" | "done" | "error", res.message);
              if (res.status === "done") {
                toast.success("Print complete!");
                // Auto-remove after 3 seconds
                setTimeout(() => {
                  useBoothStore.getState().removePrintJob(job.id);
                }, 8000);
              }
              if (res.status === "error") {
                toast.error(`Print failed: ${res.message}`);
              }
            }
          } catch { /* ignore network errors */ }
        });
    };
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Auto-fill today's date in Event Mode when the date field is empty
  useEffect(() => {
    if (!eventModeEnabled) return;
    const s = useBoothStore.getState();
    if (!s.eventDate) {
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      useBoothStore.getState().setEventDate(today);
    }
  }, [eventModeEnabled]);

  // Update date/time/location stamp — always runs when any stamp toggle or format changes.
  // stampEnabled is not used as a guard so the stamp updates immediately when toggled.
  useEffect(() => {
    const update = () => {
      const s = useBoothStore.getState();
      if (!s.stampEnabled) {
        // Clear stamp text when all stamps are off
        if (s.stampText) useBoothStore.getState().setStampText("");
        return;
      }
      const parts: string[] = [];
      const now = new Date();
      if (s.dateStampEnabled) {
        const fmt = s.dateFormat || "short";
        if (fmt === "short") parts.push(now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        else if (fmt === "mm/dd/yyyy") parts.push(now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }));
        else if (fmt === "dd/mm/yyyy") parts.push(now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }));
        else if (fmt === "iso") parts.push(now.toISOString().slice(0, 10));
        else if (fmt === "long") parts.push(now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
        else parts.push(now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      }
      if (s.timeStampEnabled) {
        const tfmt = s.timeFormat || "12h";
        if (tfmt === "12h") parts.push(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
        else parts.push(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }));
      }
      if (s.locationStampEnabled && s.locationText) {
        parts.push(s.locationText);
      }
      useBoothStore.getState().setStampText(parts.join(" \u00b7 "));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [stampEnabled, dateStampEnabled, timeStampEnabled, locationStampEnabled, locationText, dateFormat, timeFormat]);

  // Handlers
  const handleLogoDrop = useCallback(async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    const s = useBoothStore.getState();
    s.setLogo(localUrl, "");
    s.setLogoOriginal(localUrl);
    try {
      const result = await api.uploadLogo(file);
      const serverUrl = api.imageUrl(result.filename);
      useBoothStore.getState().setLogo(serverUrl, result.filename);
      useBoothStore.getState().setLogoOriginal(serverUrl);
    } catch (err) {
      toast.error("Upload failed - using local copy");
    }
  }, []);

  const handleLogoCropped = useCallback(async (blob: Blob, url: string) => {
    useBoothStore.getState().setLogo(url, "");
    try {
      const result = await api.uploadLogo(blob);
      useBoothStore.getState().setLogo(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handlePhotoDrop = useCallback(async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    // New image: set both preview and original
    const s = useBoothStore.getState();
    s.setPhoto(localUrl, "");
    s.setPhotoOriginal(localUrl);
    try {
      const result = await api.uploadPhoto(file);
      const serverUrl = api.imageUrl(result.filename);
      useBoothStore.getState().setPhoto(serverUrl, result.filename);
      useBoothStore.getState().setPhotoOriginal(serverUrl);
    } catch (err) {
      toast.error("Upload failed - using local copy");
    }
  }, []);

  const handlePhotoCropped = useCallback(async (blob: Blob, url: string) => {
    // Only update the preview (cropped), keep the original untouched
    useBoothStore.getState().setPhoto(url, "");
    try {
      const result = await api.uploadPhoto(blob);
      useBoothStore.getState().setPhoto(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handleDeviceCapture = useCallback(async (blob: Blob, url: string) => {
    const s = useBoothStore.getState();
    s.setPhoto(url, "");
    s.setPhotoOriginal(url);
    try {
      const result = await api.uploadPhoto(blob);
      const serverUrl = api.imageUrl(result.filename);
      useBoothStore.getState().setPhoto(serverUrl, result.filename);
      useBoothStore.getState().setPhotoOriginal(serverUrl);
    } catch { /* keep local */ }
  }, []);

  const handlePiCapture = useCallback(async (url: string, filename: string) => {
    const s = useBoothStore.getState();
    s.setPhoto(url, filename);
    s.setPhotoOriginal(url);
  }, []);

  // Multi-capture: each photo captured individually
  const handleMultiCaptureSingle = useCallback(async (blob: Blob, url: string) => {
    // Upload each photo to the Pi as it's captured
    try {
      await api.uploadPhoto(blob);
    } catch { /* ignore upload failure, blob is local */ }
  }, []);

  // Multi-capture session complete
  const handleMultiCaptureComplete = useCallback(async (photos: { blob: Blob; url: string }[]) => {
    const s = useBoothStore.getState();
    if (photos.length === 0) return;

    if (photos.length === 1) {
      // Single photo — just set as main photo
      s.setPhotoMode("single");
      s.setPhoto(photos[0].url, "");
      try {
        const result = await api.uploadPhoto(photos[0].blob);
        useBoothStore.getState().setPhoto(api.imageUrl(result.filename), result.filename);
      } catch { /* keep local */ }
      toast.info("Photo captured! Ready to print.");
      return;
    }

    // Multiple photos — switch to grid mode for both layouts
    s.setPhotoMode("grid");

    // Pick a good layout based on count and user preference
    if (s.multiCaptureLayout === "single") {
      // Vertical strip — all on one receipt
      const stripLayouts: Record<number, string> = { 2: "2-stack", 3: "3-strip", 4: "4-strip" };
      const layoutKey = stripLayouts[Math.min(photos.length, 4)] || `${Math.min(photos.length, 6)}-grid`;
      useBoothStore.getState().setGridLayout(layoutKey);
    } else {
      // "separate" — also use strip layout so each photo is full-width stacked
      // They will be printed individually (handlePrint detects this)
      const stripLayouts: Record<number, string> = { 2: "2-stack", 3: "3-strip", 4: "4-strip" };
      const layoutKey = stripLayouts[Math.min(photos.length, 4)] || `${Math.min(photos.length, 6)}-grid`;
      useBoothStore.getState().setGridLayout(layoutKey);
    }

    // Clear existing grid photos and add all captured ones
    const currentGrid = useBoothStore.getState().gridPhotos;
    currentGrid.forEach((g) => useBoothStore.getState().removeGridPhoto(g.id));

    for (const photo of photos) {
      try {
        const result = await api.uploadPhoto(photo.blob);
        useBoothStore.getState().addGridPhoto({
          id: `mc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          preview: api.imageUrl(result.filename),
          filename: result.filename,
          cropData: null,
        });
      } catch {
        useBoothStore.getState().addGridPhoto({
          id: `mc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          preview: photo.url,
          filename: "",
          cropData: null,
        });
      }
    }

    if (s.multiCaptureLayout === "single") {
      toast.info(`${photos.length} photos added to grid — all on one strip!`);
    } else {
      toast.info(`${photos.length} photos ready — each will print as separate cutout.`);
    }
  }, []);

  // Helper: send a blob to print with given jobId
  const sendPrintJob = useCallback(async (blob: Blob, jobId: string, label: string) => {
    const s = useBoothStore.getState();
    const preset = BRIGHTNESS_PRESETS.find((p) => p.value === s.printBrightness) || BRIGHTNESS_PRESETS[1];
    useBoothStore.getState().addPrintJob(jobId);
    try {
      const res = await api.printImage(blob, jobId, {
        algorithm: s.algorithm,
        contrast: preset.contrast,
        brightness: preset.brightness,
      });
      if (res.error) throw new Error(res.error);
      useBoothStore.getState().updatePrintJob(jobId, "printing", label);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      useBoothStore.getState().updatePrintJob(jobId, "error", msg);
      toast.error(`Print failed: ${msg}`);
    }
  }, []);

  // WYSIWYG print: export canvas as image blob and send directly (supports copies + separate cutouts)
  const handlePrint = useCallback(async () => {
    const s = useBoothStore.getState();
    const copies = s.printCopies || 1;
    const isSeparateMode = s.photoMode === "grid" && s.multiCaptureLayout === "separate" && s.gridPhotos.length > 1;

    if (isSeparateMode) {
      // SEPARATE CUTOUTS: fetch each grid photo image and send it directly to printer
      const gridPhotos = [...s.gridPhotos];
      const totalJobs = gridPhotos.length * copies;

      toast.info(`Printing ${gridPhotos.length} photos × ${copies} copies (${totalJobs} prints)...`);

      for (let p = 0; p < gridPhotos.length; p++) {
        const photo = gridPhotos[p];
        try {
          // Fetch the image as a blob
          const imgRes = await fetch(photo.preview);
          const imgBlob = await imgRes.blob();

          for (let c = 0; c < copies; c++) {
            const jobId = `job_${Date.now()}_${p}_${c}`;
            await sendPrintJob(imgBlob, jobId, `Photo ${p + 1}/${gridPhotos.length}${copies > 1 ? ` copy ${c + 1}/${copies}` : ""}`);
          }
        } catch (err: unknown) {
          toast.error(`Photo ${p + 1} failed: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }

      toast.success(`${totalJobs} separate prints queued!`);
    } else {
      // NORMAL / SINGLE STRIP: export canvas once, send copies
      toast.info(`Preparing print${copies > 1 ? ` (${copies} copies)` : ""}...`);

      try {
        const blob = await canvasRef.current?.exportImage();
        if (!blob) {
          throw new Error("Failed to export canvas — is the preview visible?");
        }

        for (let i = 0; i < copies; i++) {
          const jobId = `job_${Date.now()}_${i}`;
          await sendPrintJob(blob, jobId, copies > 1 ? `Printing copy ${i + 1}/${copies}...` : "Printing...");
        }
        toast.success(copies > 1 ? `${copies} copies queued!` : "Print job queued!");
        api.saveToGallery(blob, "print").catch(() => {});
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Print failed: ${msg}`);
      }
    }
  }, [sendPrintJob]);

  const requestPrintPreview = useCallback(async () => {
    const s = useBoothStore.getState();
    const isSeparateMode = s.photoMode === "grid" && s.multiCaptureLayout === "separate" && s.gridPhotos.length > 1;
    if (isSeparateMode) {
      previewBlobRef.current = null;
      previewQrMetaRef.current = null;
      setPreviewImageUrl(null);
      setShowPrintPreview(true);
      return;
    }

    // Generate QR URL BEFORE exporting so the canvas snapshot includes the correct QR
    const useArchivioShare = s.qrDestination === "archivio-share" && !!SHARE_SHORT_URL;
    if (useArchivioShare) {
      const photoId = nanoid();
      const shortCode = generateShortCode();
      previewQrMetaRef.current = { photoId, shortCode };
      useBoothStore.getState().setQrUrl(`${SHARE_SHORT_URL}/${cafeSlug}/s/${shortCode}`);
      // Wait for canvas to re-render with the new QR
      await new Promise((r) => setTimeout(r, 300));
    } else {
      previewQrMetaRef.current = null;
    }

    const blob = await canvasRef.current?.exportImage() ?? null;
    if (!blob) return;
    previewBlobRef.current = blob;
    setPreviewImageUrl(URL.createObjectURL(blob));
    setShowPrintPreview(true);
  }, []);

  const closePrintPreview = useCallback(() => {
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    setPreviewImageUrl(null);
    previewBlobRef.current = null;
    setShowPrintPreview(false);
  }, [previewImageUrl]);

  // Stable array refs for Sliders to avoid "Maximum update depth" (Radix re-renders on new array ref)
  const headerHeightSliderValue = useMemo(() => [headerHeight], [headerHeight]);
  const headerTextSizeSliderValue = useMemo(() => [headerTextSize], [headerTextSize]);
  const qrSizeSliderValue = useMemo(() => [qrSize], [qrSize]);

  const hasPhoto = photoMode === "single"
    ? !!(photoFilename || photoPreview)
    : gridPhotos.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 md:h-14 max-w-7xl items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-sm md:text-lg font-bold tracking-tight">{embedded && cafeName ? cafeName : "Photo Booth"}</span>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1">
              {can("canSelectTemplate") && (
              <Link href={`/${cafeSlug}/templates`}>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  <LayoutTemplate className="h-3 w-3" /> Templates
                </Button>
              </Link>
              )}
              <Link href={`/${cafeSlug}/gallery`}>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  <Layers className="h-3 w-3" /> Gallery
                </Button>
              </Link>
              <Link href={`/${cafeSlug}/kiosk`}>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  <CameraIcon className="h-3 w-3" /> Kiosk
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            {isDesignMode && (
              <Button
                size="sm"
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate}
                className="h-7 gap-1.5 text-xs font-semibold gradient-warm text-white"
              >
                <Save className="h-3 w-3" />
                {savingTemplate ? "Saving..." : "Save Template"}
              </Button>
            )}
            {!isDesignMode && can("canSelectTemplate") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDashboardAsTemplate}
                disabled={savingDashboardTemplate}
                className="h-7 gap-1.5 text-xs hidden sm:flex"
              >
                <Save className="h-3 w-3" />
                {savingDashboardTemplate ? "Saving..." : "Save as Template"}
              </Button>
            )}
            <Badge
              variant={piConnected ? "default" : "destructive"}
              className={`gap-1 md:gap-1.5 text-[10px] md:text-xs font-normal ${piConnected ? "bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/15 dark:text-primary" : ""}`}
            >
              {piConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{piConnected ? "Pi" : "Offline"}</span>
            </Badge>
            {piConnected && (
              <>
                <Badge variant="outline" className={`gap-1 text-[10px] md:text-xs font-normal ${printerAvailable ? "" : "text-muted-foreground"}`}>
                  <Printer className="h-3 w-3" />
                </Badge>
                <Badge variant="outline" className={`gap-1 text-[10px] md:text-xs font-normal ${cameraAvailable ? "" : "text-muted-foreground"}`}>
                  <Camera className="h-3 w-3" />
                </Badge>
              </>
            )}
            {SHARE_SHORT_URL && !shareServiceOnline && (
              <Badge variant="outline" className="gap-1 text-[10px] md:text-xs font-normal text-warm dark:text-warm border-warm/40 dark:border-warm/40" title="Share service offline — photos will sync when connection returns">
                <Share2 className="h-3 w-3" /> Share offline
              </Badge>
            )}
            <Separator orientation="vertical" className="h-4 md:h-5" />
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      {/* Main responsive layout */}
      <main className="mx-auto max-w-7xl px-3 md:px-4 py-4 md:py-6">
        <div className="grid gap-4 md:gap-6 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px_240px]">
          {/* Column 1: Controls */}
          <div className="space-y-3 md:space-y-4">
            {/* Logo + Header Height */}
            <Card className="p-3 md:p-4">
              <ImageDropzone
                label="Company Logo"
                hint="PNG or JPG, white bg works best"
                value={logoPreview}
                originalValue={logoOriginalPreview}
                onDrop={handleLogoDrop}
                onClear={() => useBoothStore.getState().clearLogo()}
                onCropped={handleLogoCropped}
                onReset={() => useBoothStore.getState().resetLogoToOriginal()}
                compact
              />
              <div className="mt-3 flex items-center gap-3">
                <Label className="w-20 text-xs text-muted-foreground">Header height</Label>
                <Slider
                  value={headerHeightSliderValue}
                  onValueChange={([v]) => useBoothStore.getState().setHeaderHeight(v)}
                  min={10}
                  max={200}
                  step={2}
                  className="flex-1"
                />
                <span className="w-8 text-right text-xs text-muted-foreground">{headerHeight}</span>
              </div>

              {/* Header sub-text */}
              {can("canEditHeaderText") && !isLocked("headerText") && (<>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Text below logo</Label>
                <Switch checked={headerTextEnabled} onCheckedChange={(v) => useBoothStore.getState().setHeaderTextEnabled(v)} />
              </div>
              {headerTextEnabled && (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Event name or tagline..."
                    value={headerText}
                    onChange={(e) => useBoothStore.getState().setHeaderText(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Slider
                      value={headerTextSizeSliderValue}
                      onValueChange={([v]) => useBoothStore.getState().setHeaderTextSize(v)}
                      min={8}
                      max={36}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-6 text-right text-[10px] text-muted-foreground">{headerTextSize}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => useBoothStore.getState().setHeaderTextBold(!useBoothStore.getState().headerTextBold)}
                        className={`rounded border p-1 text-[10px] ${headerTextBold ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="font-bold">B</span>
                      </button>
                      <button
                        onClick={() => useBoothStore.getState().setHeaderTextItalic(!useBoothStore.getState().headerTextItalic)}
                        className={`rounded border p-1 text-[10px] ${headerTextItalic ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="italic">I</span>
                      </button>
                      <button
                        onClick={() => useBoothStore.getState().setHeaderTextUnderline(!useBoothStore.getState().headerTextUnderline)}
                        className={`rounded border p-1 text-[10px] ${headerTextUnderline ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="underline">U</span>
                      </button>
                    </div>
                  </div>
                  {/* Header font picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] hover:bg-muted w-full justify-between">
                        <Type className="h-3 w-3 text-muted-foreground" />
                        <span style={{ fontFamily: `"${headerTextFont}", sans-serif` }}>{headerTextFont}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start" onOpenAutoFocus={() => preloadAllFonts()}>
                      <ScrollArea className="h-56">
                        {GOOGLE_FONTS.map((f) => (
                          <button
                            key={f.name}
                            onMouseEnter={() => loadGoogleFont(f.name)}
                            className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${f.name === headerTextFont ? "bg-muted font-semibold" : ""}`}
                            style={{ fontFamily: `"${f.name}", sans-serif` }}
                            onClick={() => { loadGoogleFont(f.name); useBoothStore.getState().setHeaderTextFont(f.name); }}
                          >
                            {f.name}
                            <span className="ml-1.5 text-[9px] uppercase text-muted-foreground">{f.category}</span>
                          </button>
                        ))}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              </>)}
            </Card>

            {/* Photo */}
            <Card id="section-photo" className="p-3 md:p-4">
              <Tabs
                value={photoMode}
                onValueChange={(v) => useBoothStore.getState().setPhotoMode(v as "single" | "grid")}
              >
                <TabsList className="mb-3 w-full">
                  <TabsTrigger value="single" className="flex-1 text-xs">Single Photo</TabsTrigger>
                  {can("canUseGridMode") && (
                  <TabsTrigger value="grid" className="flex-1 text-xs">Photo Grid</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="single" className="space-y-3">
                  {can("canUploadPhoto") && (
                  <ImageDropzone
                    label="Photo"
                    hint="Drag a photo or click to browse"
                    value={photoPreview}
                    originalValue={photoOriginalPreview}
                    onDrop={handlePhotoDrop}
                    onClear={() => useBoothStore.getState().clearPhoto()}
                    onCropped={handlePhotoCropped}
                    onReset={() => useBoothStore.getState().resetPhotoToOriginal()}
                  />
                  )}
                  {photoPreview && (
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => useBoothStore.getState().clearPhoto()} className="gap-1.5 text-xs">
                        <CameraIcon className="h-3.5 w-3.5" />
                        Retake photo
                      </Button>
                    </div>
                  )}

                  {/* Aspect + Rotate */}
                  {(can("canChangeAspectRatio") || can("canRotatePhoto")) && (
                  <div className="space-y-2">
                    {can("canChangeAspectRatio") && (<>
                    <Label className="text-xs text-muted-foreground">Ratio</Label>
                    <div className="flex items-center gap-2">
                      <ToggleGroup
                        type="single"
                        value={photoAspectRatio}
                        onValueChange={(v) => { if (v) useBoothStore.getState().setPhotoAspectRatio(v as AspectRatio); }}
                        size="sm"
                        className="flex-wrap"
                      >
                        <ToggleGroupItem value="free" className="text-[10px] px-1.5 h-7">Free</ToggleGroupItem>
                        <ToggleGroupItem value="1:1" className="text-[10px] px-1.5 h-7">1:1</ToggleGroupItem>
                        <ToggleGroupItem value="4:3" className="text-[10px] px-1.5 h-7">4:3</ToggleGroupItem>
                        <ToggleGroupItem value="3:4" className="text-[10px] px-1.5 h-7">3:4</ToggleGroupItem>
                        <ToggleGroupItem value="4:5" className="text-[10px] px-1.5 h-7">4:5</ToggleGroupItem>
                        <ToggleGroupItem value="5:4" className="text-[10px] px-1.5 h-7">5:4</ToggleGroupItem>
                        <ToggleGroupItem value="2:3" className="text-[10px] px-1.5 h-7">2:3</ToggleGroupItem>
                        <ToggleGroupItem value="3:2" className="text-[10px] px-1.5 h-7">3:2</ToggleGroupItem>
                        <ToggleGroupItem value="9:16" className="text-[10px] px-1.5 h-7">9:16</ToggleGroupItem>
                        <ToggleGroupItem value="16:9" className="text-[10px] px-1.5 h-7">16:9</ToggleGroupItem>
                      </ToggleGroup>
                      {can("canRotatePhoto") && (
                      <button
                        onClick={() => useBoothStore.getState().setPhotoRotation((photoRotation + 90) % 360)}
                        className="ml-auto rounded-md border p-1.5 hover:bg-muted shrink-0"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      )}
                    </div>
                    </>)}
                    {!can("canChangeAspectRatio") && can("canRotatePhoto") && (
                      <button
                        onClick={() => useBoothStore.getState().setPhotoRotation((photoRotation + 90) % 360)}
                        className="rounded-md border p-1.5 hover:bg-muted"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  )}

                  {/* Camera buttons */}
                  {can("canUseCamera") && (
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or capture</span></div>
                    </div>
                    <DeviceCameraButton onCapture={handleDeviceCapture} />
                    <CameraButton onCapture={handlePiCapture} cameraAvailable={cameraAvailable} />

                    {/* Multi-capture */}
                    {can("canUseMultiCapture") && (
                    <MultiCaptureButton
                      count={multiCaptureCount}
                      onCountChange={(v) => useBoothStore.getState().setMultiCaptureCount(v)}
                      layout={multiCaptureLayout}
                      onLayoutChange={(v) => useBoothStore.getState().setMultiCaptureLayout(v)}
                      onCapture={handleMultiCaptureSingle}
                      onSessionComplete={handleMultiCaptureComplete}
                      piCameraAvailable={cameraAvailable}
                    />
                    )}
                  </div>
                  )}
                </TabsContent>

                <TabsContent value="grid">
                  <PhotoGridEditor />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Print Style — filter, algorithm, brightness, border */}
            {(can("canChangePrintStyle") || can("canChangeBrightness") || can("canChangeFilter") || can("canChangeBorder")) && (
            <Card id="section-style" className="p-3 md:p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Print Style</Label>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Thermal printers output B&amp;W — the live preview shows exactly how your print will look.
                </p>
                <Select value={algorithm} onValueChange={(v) => useBoothStore.getState().setAlgorithm(v)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITHMS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-xs">
                        <span className="font-medium">{a.label}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">— {a.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-16 shrink-0">Brightness</Label>
                  <ToggleGroup
                    type="single"
                    value={printBrightness}
                    onValueChange={(v) => { if (v) useBoothStore.getState().setPrintBrightness(v); }}
                    size="sm"
                    className="flex-1"
                  >
                    {BRIGHTNESS_PRESETS.map((p) => (
                      <ToggleGroupItem key={p.value} value={p.value} className="text-[10px] px-2 h-6 flex-1">
                        {p.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground">Photo filter</Label>
                  <Select value={photoFilter} onValueChange={(v) => useBoothStore.getState().setPhotoFilter(v)}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Standard B&amp;W — neutral thermal</SelectItem>
                      <SelectItem value="sepia" className="text-xs">Warm Sepia — warm mid-tones</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-[10px] text-muted-foreground">Photo border</Label>
                  <Select value={photoBorderId} onValueChange={(v) => useBoothStore.getState().setPhotoBorderId(v)}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BORDER_STYLES.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          <BorderPreview border={b} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
            )}

            {/* Memo + Font */}
            {can("canEditMemo") && !isLocked("memo") && (
            <Card className="p-3 md:p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Memo / Quote
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="warmth is found in the ones we hold close"
                    value={memo}
                    onChange={(e) => useBoothStore.getState().setMemo(e.target.value)}
                    className="resize-none text-sm flex-1"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-end shrink-0 text-[10px] h-7"
                    disabled={!memo.trim() || savedMemos.includes(memo.trim())}
                    onClick={() => useBoothStore.getState().addSavedMemo(memo)}
                  >
                    Save
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {savedMemos.map((msg, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 group">
                      <button
                        onClick={() => useBoothStore.getState().setMemo(msg)}
                        className="text-[10px] px-2 py-1 rounded-l-full border border-r-0 border-muted-foreground/20 hover:border-foreground/40 hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground"
                      >
                        {msg.length > 30 ? msg.slice(0, 30) + '...' : msg}
                      </button>
                      <button
                        onClick={() => useBoothStore.getState().removeSavedMemo(msg)}
                        className="text-[10px] px-1 py-1 rounded-r-full border border-l-0 border-muted-foreground/20 hover:border-red-400 hover:bg-red-500/10 transition-all text-muted-foreground/40 hover:text-red-500"
                        title="Remove memo"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              {can("canChangeFont") && <FontPicker />}
            </Card>
            )}

            {/* QR + Algorithm + Stamp */}
            <Card className="p-3 md:p-4 space-y-4">
              {can("canEditQr") && !isLocked("qr") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">QR Code</Label>
                  <Switch checked={qrEnabled} onCheckedChange={(v) => useBoothStore.getState().setQrEnabled(v)} />
                </div>
                {qrEnabled && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Destination</Label>
                      <ToggleGroup
                        type="single"
                        value={qrDestination}
                        onValueChange={(v) => v && (v === "custom" || v === "archivio-share") && useBoothStore.getState().setQrDestination(v)}
                        className="flex flex-wrap gap-1"
                      >
                        <ToggleGroupItem value="archivio-share" className="text-xs px-2.5 py-1" aria-label="Archivio Share">
                          <Share2 className="h-3 w-3 mr-1" /> Archivio Share
                        </ToggleGroupItem>
                        <ToggleGroupItem value="custom" className="text-xs px-2.5 py-1" aria-label="Custom URL">
                          Custom URL
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {qrDestination === "archivio-share" ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {SHARE_SHORT_URL ? (
                            <>QR will link to <span className="font-mono">{SHARE_SHORT_URL}</span>. The exact link is set when you print and the photo is uploaded to the share site.</>
                          ) : (
                            <>Set <span className="font-mono">NEXT_PUBLIC_SHARE_SHORT_URL</span> (and <span className="font-mono">NEXT_PUBLIC_SHARE_URL</span>) in <span className="font-mono">.env.local</span> to use Archivio Share.</>
                          )}
                        </p>
                      </div>
                    ) : (
                      <Input
                        placeholder="https://archivio.app/photo/001"
                        value={qrUrl}
                        onChange={(e) => useBoothStore.getState().setQrUrl(e.target.value)}
                        className="text-sm font-mono"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground w-8">Size</Label>
                      <Slider
                        value={qrSizeSliderValue}
                        onValueChange={([v]) => useBoothStore.getState().setQrSize(v)}
                        min={32}
                        max={200}
                        step={4}
                        className="flex-1"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground">Caption (below QR)</Label>
                        <Switch
                          checked={showQrCaption}
                          onCheckedChange={(v) => useBoothStore.getState().setShowQrCaption(v)}
                        />
                      </div>
                      {showQrCaption && (
                        <>
                          <Input
                            placeholder="e.g. Scan for your digital copy"
                            value={qrCaption}
                            onChange={(e) => useBoothStore.getState().setQrCaption(e.target.value)}
                            className="text-sm"
                            maxLength={80}
                          />
                          <p className="text-[9px] text-muted-foreground">{qrCaption.length}/80</p>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              )}
              {can("canEditQr") && !isLocked("qr") && <Separator />}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Event mode</Label>
                  <Switch
                    checked={eventModeEnabled}
                    onCheckedChange={(v) => {
                      useBoothStore.getState().setEventModeEnabled(v);
                      // Auto-fill today's date when enabling event mode and field is empty
                      if (v && !useBoothStore.getState().eventDate) {
                        const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                        useBoothStore.getState().setEventDate(today);
                      }
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Use a fixed event name, date &amp; location on all prints.</p>
                {eventModeEnabled && (
                  <>
                    <Input
                      placeholder="Event name"
                      value={eventName}
                      onChange={(e) => useBoothStore.getState().setEventName(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="e.g. Feb 16, 2026"
                      value={eventDate}
                      onChange={(e) => useBoothStore.getState().setEventDate(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="e.g. Central Park, NYC"
                      value={eventLocation}
                      onChange={(e) => useBoothStore.getState().setEventLocation(e.target.value)}
                      className="text-sm"
                    />
                  </>
                )}
              </div>
              {can("canEditStamps") && !isLocked("stamps") && (<>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stamps</Label>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Date</Label>
                  </div>
                  <Switch checked={dateStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setDateStampEnabled(v)} />
                </div>
                {dateStampEnabled && (
                  <Select value={dateFormat} onValueChange={(v) => useBoothStore.getState().setDateFormat(v)}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Feb 12, 2026</SelectItem>
                      <SelectItem value="long">Thursday, February 12, 2026</SelectItem>
                      <SelectItem value="mm/dd/yyyy">02/12/2026</SelectItem>
                      <SelectItem value="dd/mm/yyyy">12/02/2026</SelectItem>
                      <SelectItem value="iso">2026-02-12</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Time</Label>
                  </div>
                  <Switch checked={timeStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setTimeStampEnabled(v)} />
                </div>
                {timeStampEnabled && (
                  <Select value={timeFormat} onValueChange={(v) => useBoothStore.getState().setTimeFormat(v)}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (3:30 PM)</SelectItem>
                      <SelectItem value="24h">24-hour (15:30)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Location</Label>
                  </div>
                  <Switch checked={locationStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setLocationStampEnabled(v)} />
                </div>
                {locationStampEnabled && (
                  <Input
                    placeholder="e.g. Central Park, NYC"
                    value={locationText}
                    onChange={(e) => useBoothStore.getState().setLocationText(e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>
              </>)}
              {can("canReorderSections") && !isLocked("sectionOrder") && (<>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Receipt order</Label>
                <p className="text-[10px] text-muted-foreground">Drag to reorder sections on the receipt.</p>
                <SectionOrderList />
              </div>
              </>)}
            </Card>

            {/* Templates */}
            {can("canSelectTemplate") && (
            <Card id="section-templates" className="p-3 md:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Templates</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={handleSaveDashboardAsTemplate}
                  disabled={savingDashboardTemplate}
                >
                  <Save className="h-3 w-3" /> {savingDashboardTemplate ? "Saving..." : "Save Design"}
                </Button>
              </div>
              {activeTemplate && (
                <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5">
                  <LayoutTemplate className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-primary flex-1 truncate font-medium">{activeTemplate.name}</span>
                  <button onClick={clearActiveTemplate} className="text-[10px] text-muted-foreground hover:text-destructive px-1">remove</button>
                </div>
              )}
              {savedTemplates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-2">No templates saved yet</p>
              ) : (
                <ScrollArea className="max-h-40">
                  <div className="space-y-1">
                    {savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className={`flex items-center gap-2 rounded p-1.5 cursor-pointer hover:bg-muted transition-colors ${activeTemplate?.id === tpl.id ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
                        onClick={() => applyTemplate(tpl.id)}
                      >
                        <div className="w-8 h-12 rounded border bg-muted/50 shrink-0 overflow-hidden flex items-center justify-center">
                          {tpl.thumbnail ? (
                            <img src={api.previewUrl(tpl.thumbnail)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <LayoutTemplate className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-xs truncate flex-1">{tpl.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </Card>
            )}

            {/* Print copies + Print button */}
            <div id="section-print" className="space-y-2">
              {!piConnected && (
                <div className="rounded-lg border border-warm/30 bg-warm/8 px-3 py-2 text-xs text-foreground/70 dark:text-warm flex items-center gap-2">
                  <WifiOff className="h-4 w-4 shrink-0" />
                  <span>Printer offline — connect to the Pi to print.</span>
                </div>
              )}
              {can("canChangeCopies") && (
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Copies</Label>
                <ToggleGroup
                  type="single"
                  value={String(printCopies)}
                  onValueChange={(v) => { if (v) useBoothStore.getState().setPrintCopies(Number(v)); }}
                  size="sm"
                  className="flex-1"
                >
                  {Array.from({ length: Math.min(maxCopies || 5, 10) }, (_, i) => i + 1).map((n) => (
                    <ToggleGroupItem key={n} value={String(n)} className="text-[10px] px-2 h-7 flex-1">
                      x{n}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              )}
              <PrintButton disabled={!hasPhoto || !piConnected} onPrint={requestPrintPreview} />
            </div>
          </div>

          {/* Column 2: Receipt Preview (Konva Canvas) */}
          <div className="md:sticky md:top-16 md:self-start">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</h2>
                <span className="text-[9px] text-muted-foreground tracking-wide">WYSIWYG · 80mm receipt</span>
              </div>
              <div className="flex justify-center rounded-lg bg-muted/30 p-0 overflow-hidden">
                <ReceiptCanvas ref={canvasRef} />
              </div>
              <div className="space-y-1.5 px-1">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-20 shrink-0">Min height</Label>
                  <Slider
                    value={receiptHeightSliderValue}
                    onValueChange={([v]) => useBoothStore.getState().setReceiptHeightOverride(v)}
                    min={0}
                    max={800}
                    step={10}
                    className="flex-1"
                  />
                  <span className="w-8 text-right text-[10px] text-muted-foreground">{receiptHeightOverride || "auto"}</span>
                </div>
              </div>
              <p className="text-center text-[9px] text-muted-foreground hidden md:block">Click to select · Drag to move · Handles to resize/rotate · Double-click text to edit</p>
            </div>
          </div>

          {/* Column 3: Stickers — Desktop only (hidden below lg) */}
          {can("canUseStickers") && (
          <div className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            <Card className="p-4 h-[calc(100vh-8rem)] overflow-hidden">
              <StickerPanel />
            </Card>
          </div>
          )}
        </div>
      </main>

      {/* Mobile/Tablet sticker button + sheet (visible below lg) */}
      {can("canUseStickers") && (
      <div className="lg:hidden">
        <Sheet open={stickerSheetOpen} onOpenChange={setStickerSheetOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full"
            >
              <Sticker className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] rounded-t-2xl p-4">
            <SheetTitle className="text-sm font-medium mb-2">Stickers</SheetTitle>
            <div className="h-[calc(60vh-4rem)] overflow-auto">
              <StickerPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      )}

      {/* Mobile bottom navigation (visible below sm) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30">
        <InteractiveMenu
          items={[
            { label: "photo", icon: ImageIcon },
            { label: "style", icon: Wand2 },
            { label: "templates", icon: LayoutTemplate },
            { label: "print", icon: Printer },
          ] as InteractiveMenuItem[]}
          accentColor="var(--warm)"
          onItemClick={(_i, label) => {
            const id = `section-${label}`;
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>
      {/* Bottom spacer for mobile nav */}
      <div className="sm:hidden h-14" />

      {/* Print queue */}
      <PrintQueuePanel />

      {/* Print preview confirmation */}
      <Dialog open={showPrintPreview} onOpenChange={(open) => { if (!open) closePrintPreview(); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Print preview</DialogTitle>
            <DialogDescription>
              {previewImageUrl
                ? "This is what will print. Confirm to send to printer."
                : `You're about to print ${gridPhotos.length} photo(s). Confirm to send.`}
            </DialogDescription>
          </DialogHeader>
          {previewImageUrl && (
            <>
              <div className="flex justify-center rounded-lg border bg-muted/30 overflow-hidden">
                <img src={previewImageUrl} alt="Print preview" className="max-h-[60vh] w-auto object-contain" />
              </div>
              {(can("canShareDigital") || can("canDownloadImage")) && (
              <div className="flex flex-wrap gap-2">
                {can("canShareDigital") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      const blob = previewBlobRef.current;
                      if (!blob) { toast.error("No preview image"); return; }
                      const file = new File([blob], "photo-booth-receipt.png", { type: "image/png" });
                      if (navigator.share && navigator.canShare?.({ files: [file] })) {
                        await navigator.share({ files: [file], title: "Photo Booth", text: "My receipt" });
                        toast.success("Shared!");
                      } else {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "photo-booth-receipt.png";
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Saved to device");
                      }
                    } catch (e: unknown) {
                      if (!(e instanceof Error && e.name === "AbortError")) toast.error(e instanceof Error ? e.message : "Share failed");
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" /> Share / Save
                </Button>
                )}
                {can("canDownloadImage") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const blob = previewBlobRef.current;
                    if (!blob) { toast.error("No preview image"); return; }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "photo-booth-receipt.png";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Saved to device");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Save to device
                </Button>
                )}
              </div>
              )}
            </>
          )}
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={closePrintPreview}>Cancel</Button>
            <Button
              onClick={async () => {
                const s = useBoothStore.getState();
                const isSeparateMode = s.photoMode === "grid" && s.multiCaptureLayout === "separate" && s.gridPhotos.length > 1;
                if (isSeparateMode) {
                  handlePrint();
                  closePrintPreview();
                  return;
                }

                // Use the blob that was already exported WITH the correct QR code during preview
                const blob = previewBlobRef.current;
                const qrMeta = previewQrMetaRef.current;
                const useArchivioShare = s.qrDestination === "archivio-share" && !!SHARE_SHORT_URL;

                closePrintPreview();

                if (!blob) {
                  toast.error("No preview to print. Please try again.");
                  return;
                }

                try {
                  const copies = s.printCopies || 1;
                  for (let i = 0; i < copies; i++) {
                    const jobId = `job_${Date.now()}_${i}`;
                    await sendPrintJob(blob, jobId, copies > 1 ? `Printing copy ${i + 1}/${copies}...` : "Printing...");
                  }
                  toast.success(copies > 1 ? `${copies} copies queued!` : "Print job queued!");

                  api.saveToGallery(blob, "print").catch(() => {});

                  if (useArchivioShare && qrMeta) {
                    const compressed = await compressForUpload(blob);
                    await enqueueUpload(qrMeta.photoId, qrMeta.shortCode, compressed.original, compressed.thumbnail, compressed.social, null, cafeSlug);
                  }
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Print or upload failed");
                }
              }}
            >
              Confirm & Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
