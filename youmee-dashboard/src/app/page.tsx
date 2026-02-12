"use client";

import { useEffect, useCallback, useRef } from "react";
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
import { ReceiptCanvas } from "@/components/receipt-canvas";
import { CameraButton } from "@/components/camera-button";
import { DeviceCameraButton } from "@/components/device-camera-button";
import { PrintButton } from "@/components/print-button";
import { FontPicker } from "@/components/font-picker";
import { PhotoGridEditor } from "@/components/photo-grid-editor";
import { StickerPanel } from "@/components/sticker-panel";
import { PrintQueuePanel } from "@/components/print-queue-panel";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { useBoothStore, type AspectRatio } from "@/store/booth-store";
import { api, type StickerParam, type GridPhotoParam } from "@/lib/api";
import { Wifi, WifiOff, Printer, Camera, RotateCw, Clock, CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";

const ALGORITHMS = [
  { value: "atkinson", label: "Atkinson", desc: "Retro Mac look" },
  { value: "bayer8", label: "Bayer 8x8", desc: "Crosshatch, sharpest" },
  { value: "floyd_steinberg", label: "Floyd-Steinberg", desc: "Standard, fine dots" },
  { value: "stucki", label: "Stucki", desc: "Smooth gradients" },
];

/** Fetch a blob URL and return a File for upload */
async function blobUrlToFile(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const store = useBoothStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Health check — does NOT touch logo
  useEffect(() => {
    const check = async () => {
      try {
        const h = await api.health();
        store.setPiStatus(h.status === "ok", h.camera, h.printer);
      } catch {
        store.setPiStatus(false, false, false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll print queue jobs
  useEffect(() => {
    const poll = () => {
      store.printQueue
        .filter((j) => j.status === "pending" || j.status === "printing")
        .forEach(async (job) => {
          try {
            const res = await api.printStatus(job.id);
            if (res.status !== job.status) {
              store.updatePrintJob(job.id, res.status as "printing" | "done" | "error", res.message);
              if (res.status === "done") toast.success("Print complete!");
              if (res.status === "error") toast.error(`Print failed: ${res.message}`);
            }
          } catch { /* ignore */ }
        });
    };
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update date/time/location stamp
  useEffect(() => {
    if (!store.stampEnabled) return;
    const update = () => {
      const parts: string[] = [];
      const now = new Date();
      if (store.dateStampEnabled) {
        parts.push(now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      }
      if (store.timeStampEnabled) {
        parts.push(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      }
      if (store.locationStampEnabled && store.locationText) {
        parts.push(store.locationText);
      }
      store.setStampText(parts.join(" · "));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [store.stampEnabled, store.dateStampEnabled, store.timeStampEnabled, store.locationStampEnabled, store.locationText]);

  // Handlers
  const handleLogoDrop = useCallback(async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    store.setLogo(localUrl, "");
    try {
      const result = await api.uploadLogo(file);
      store.setLogo(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handleLogoCropped = useCallback(async (blob: Blob, url: string) => {
    store.setLogo(url, "");
    try {
      const result = await api.uploadLogo(blob);
      store.setLogo(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handlePhotoDrop = useCallback(async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    store.setPhoto(localUrl, "");
    try {
      const result = await api.uploadPhoto(file);
      store.setPhoto(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handlePhotoCropped = useCallback(async (blob: Blob, url: string) => {
    store.setPhoto(url, "");
    try {
      const result = await api.uploadPhoto(blob);
      store.setPhoto(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handleDeviceCapture = useCallback(async (blob: Blob, url: string) => {
    store.setPhoto(url, "");
    try {
      const result = await api.uploadPhoto(blob);
      store.setPhoto(api.imageUrl(result.filename), result.filename);
    } catch { /* keep local */ }
  }, []);

  const handlePiCapture = useCallback(async (url: string, filename: string) => {
    store.setPhoto(url, filename);
  }, []);

  const handlePrint = useCallback(async () => {
    const s = useBoothStore.getState();
    const jobId = `job_${Date.now()}`;
    store.addPrintJob(jobId);
    toast.info("Preparing print...");

    try {
      // Ensure photo is uploaded to Pi — if filename is empty, upload from preview
      let photoFilename = s.photoFilename;
      if (s.photoMode === "single" && !photoFilename && s.photoPreview) {
        const file = await blobUrlToFile(s.photoPreview, "photo_upload.png");
        if (file) {
          const res = await api.uploadPhoto(file);
          photoFilename = res.filename;
          store.setPhoto(api.imageUrl(res.filename), res.filename);
        }
      }

      // Ensure logo is uploaded
      let logoFilename = s.logoFilename;
      if (!logoFilename && s.logoPreview) {
        const file = await blobUrlToFile(s.logoPreview, "logo_upload.png");
        if (file) {
          const res = await api.uploadLogo(file);
          logoFilename = res.filename;
          store.setLogo(api.imageUrl(res.filename), res.filename);
        }
      }

      // Ensure grid photos are uploaded — send with positions for freestyle
      let gridPhotoParams: GridPhotoParam[] = [];
      if (s.photoMode === "grid") {
        for (const gp of s.gridPhotos) {
          let filename = gp.filename;
          if (!filename && gp.preview) {
            const file = await blobUrlToFile(gp.preview, `grid_${gp.id}.png`);
            if (file) {
              const res = await api.uploadPhoto(file);
              filename = res.filename;
            }
          }
          if (filename) {
            gridPhotoParams.push({
              filename,
              x: gp.x,
              y: gp.y,
              w: gp.w,
              h: gp.h,
            });
          }
        }
      }

      // Upload stickers and build sticker params
      // Sticker positions are in px relative to 280px preview, convert to %
      const containerW = 280;
      const containerH = 600; // approximate preview height
      let stickerParams: StickerParam[] = [];
      for (const st of s.stickers) {
        // Sticker src may be blob URL or uploaded URL
        let stickerFilename = "";
        try {
          const file = await blobUrlToFile(st.src, `sticker_${st.id}.png`);
          if (file) {
            const res = await api.uploadSticker(file);
            stickerFilename = res.filename;
          }
        } catch {
          // Try uploading from URL directly
          try {
            const resp = await fetch(st.src);
            const blob = await resp.blob();
            const res = await api.uploadSticker(blob);
            stickerFilename = res.filename;
          } catch { /* skip this sticker */ }
        }
        if (stickerFilename) {
          stickerParams.push({
            filename: stickerFilename,
            x: (st.x / containerW) * 100,
            y: (st.y / containerH) * 100,
            width: (st.width / containerW) * 100,
            height: (st.height / containerH) * 100,
          });
        }
      }

      await api.printEnqueue({
        job_id: jobId,
        logo: logoFilename || undefined,
        photo: s.photoMode === "single" ? photoFilename : undefined,
        grid_photos: s.photoMode === "grid" ? gridPhotoParams : undefined,
        grid_layout: s.photoMode === "grid" ? s.gridLayout : undefined,
        grid_canvas_mode: s.photoMode === "grid" ? s.gridCanvasMode : undefined,
        memo: s.memo,
        memo_font: s.memoFont,
        memo_font_size: s.memoFontSize,
        memo_bold: s.memoBold,
        memo_italic: s.memoItalic,
        qr_url: s.qrUrl,
        algorithm: s.algorithm,
        header_height: s.headerHeight,
        section_order: s.sectionOrder,
        stamp_text: s.stampEnabled ? s.stampText : undefined,
        stickers: stickerParams.length > 0 ? stickerParams : undefined,
        photo_aspect_ratio: s.photoAspectRatio,
        photo_rotation: s.photoRotation,
        // Header sub-text
        header_text: s.headerTextEnabled ? s.headerText : undefined,
        header_text_font: s.headerTextEnabled ? s.headerTextFont : undefined,
        header_text_size: s.headerTextEnabled ? s.headerTextSize : undefined,
        header_text_bold: s.headerTextEnabled ? s.headerTextBold : undefined,
        header_text_italic: s.headerTextEnabled ? s.headerTextItalic : undefined,
        header_text_underline: s.headerTextEnabled ? s.headerTextUnderline : undefined,
      });
      store.updatePrintJob(jobId, "printing", "Printing...");
      toast.success("Print job queued!");
    } catch (err) {
      store.updatePrintJob(jobId, "error", "Failed to queue");
      toast.error("Failed to send print job");
    }
  }, []);

  const hasPhoto = store.photoMode === "single"
    ? !!(store.photoFilename || store.photoPreview)
    : store.gridPhotos.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight">Photo Booth Dashboard</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={store.piConnected ? "default" : "destructive"}
              className={`gap-1.5 text-xs font-normal ${store.piConnected ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" : ""}`}
            >
              {store.piConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {store.piConnected ? "Pi" : "Offline"}
            </Badge>
            {store.piConnected && (
              <>
                <Badge variant="outline" className={`gap-1 text-xs font-normal ${store.printerAvailable ? "" : "text-muted-foreground"}`}>
                  <Printer className="h-3 w-3" />
                </Badge>
                <Badge variant="outline" className={`gap-1 text-xs font-normal ${store.cameraAvailable ? "" : "text-muted-foreground"}`}>
                  <Camera className="h-3 w-3" />
                </Badge>
              </>
            )}
            <Separator orientation="vertical" className="h-5" />
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      {/* Main 3-column layout */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px_240px]">
          {/* Column 1: Controls */}
          <div className="space-y-4">
            {/* Logo + Header Height */}
            <Card className="p-4">
              <ImageDropzone
                label="Company Logo"
                hint="PNG or JPG, white bg works best"
                value={store.logoPreview}
                onDrop={handleLogoDrop}
                onClear={() => store.clearLogo()}
                onCropped={handleLogoCropped}
                compact
              />
              <div className="mt-3 flex items-center gap-3">
                <Label className="w-20 text-xs text-muted-foreground">Header height</Label>
                <Slider
                  value={[store.headerHeight]}
                  onValueChange={([v]) => store.setHeaderHeight(v)}
                  min={10}
                  max={200}
                  step={2}
                  className="flex-1"
                />
                <span className="w-8 text-right text-xs text-muted-foreground">{store.headerHeight}</span>
              </div>

              {/* Header sub-text */}
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Text below logo</Label>
                <Switch checked={store.headerTextEnabled} onCheckedChange={(v) => store.setHeaderTextEnabled(v)} />
              </div>
              {store.headerTextEnabled && (
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Event name or tagline..."
                    value={store.headerText}
                    onChange={(e) => store.setHeaderText(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[store.headerTextSize]}
                      onValueChange={([v]) => store.setHeaderTextSize(v)}
                      min={8}
                      max={36}
                      step={1}
                      className="flex-1"
                    />
                    <span className="w-6 text-right text-[10px] text-muted-foreground">{store.headerTextSize}</span>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => store.setHeaderTextBold(!store.headerTextBold)}
                        className={`rounded border p-1 text-[10px] ${store.headerTextBold ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="font-bold">B</span>
                      </button>
                      <button
                        onClick={() => store.setHeaderTextItalic(!store.headerTextItalic)}
                        className={`rounded border p-1 text-[10px] ${store.headerTextItalic ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="italic">I</span>
                      </button>
                      <button
                        onClick={() => store.setHeaderTextUnderline(!store.headerTextUnderline)}
                        className={`rounded border p-1 text-[10px] ${store.headerTextUnderline ? "bg-foreground text-background" : "hover:bg-muted"}`}
                      >
                        <span className="underline">U</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Photo */}
            <Card className="p-4">
              <Tabs
                value={store.photoMode}
                onValueChange={(v) => store.setPhotoMode(v as "single" | "grid")}
              >
                <TabsList className="mb-3 w-full">
                  <TabsTrigger value="single" className="flex-1 text-xs">Single Photo</TabsTrigger>
                  <TabsTrigger value="grid" className="flex-1 text-xs">Photo Grid</TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="space-y-3">
                  <ImageDropzone
                    label="Photo"
                    hint="Drag a photo or click to browse"
                    value={store.photoPreview}
                    onDrop={handlePhotoDrop}
                    onClear={() => store.clearPhoto()}
                    onCropped={handlePhotoCropped}
                  />

                  {/* Aspect + Rotate */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Ratio</Label>
                    <div className="flex items-center gap-2">
                      <ToggleGroup
                        type="single"
                        value={store.photoAspectRatio}
                        onValueChange={(v) => { if (v) store.setPhotoAspectRatio(v as AspectRatio); }}
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
                      <button
                        onClick={() => store.setPhotoRotation((store.photoRotation + 90) % 360)}
                        className="ml-auto rounded-md border p-1.5 hover:bg-muted shrink-0"
                      >
                        <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Camera buttons */}
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-dashed" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or capture</span></div>
                    </div>
                    <DeviceCameraButton onCapture={handleDeviceCapture} />
                    <CameraButton onCapture={handlePiCapture} cameraAvailable={store.cameraAvailable} />
                  </div>
                </TabsContent>

                <TabsContent value="grid">
                  <PhotoGridEditor />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Memo + Font */}
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Memo / Quote
                </Label>
                <Textarea
                  placeholder="warmth is found in the ones we hold close"
                  value={store.memo}
                  onChange={(e) => store.setMemo(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>
              <FontPicker />
            </Card>

            {/* QR + Algorithm + Stamp */}
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">QR Code Link</Label>
                <Input
                  placeholder="https://youmee.app/photo/001"
                  value={store.qrUrl}
                  onChange={(e) => store.setQrUrl(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dithering</Label>
                <Select value={store.algorithm} onValueChange={store.setAlgorithm}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITHMS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        <span className="font-medium">{a.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">— {a.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stamps</Label>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Date</Label>
                  </div>
                  <Switch checked={store.dateStampEnabled} onCheckedChange={(v) => store.setDateStampEnabled(v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Time</Label>
                  </div>
                  <Switch checked={store.timeStampEnabled} onCheckedChange={(v) => store.setTimeStampEnabled(v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Location</Label>
                  </div>
                  <Switch checked={store.locationStampEnabled} onCheckedChange={(v) => store.setLocationStampEnabled(v)} />
                </div>
                {store.locationStampEnabled && (
                  <Input
                    placeholder="e.g. Central Park, NYC"
                    value={store.locationText}
                    onChange={(e) => store.setLocationText(e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>
            </Card>

            {/* Print */}
            <PrintButton disabled={!hasPhoto} onPrint={handlePrint} />
          </div>

          {/* Column 2: Receipt Preview */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</h2>
                <span className="text-[9px] text-muted-foreground tracking-wide">80mm receipt</span>
              </div>
              <div className="flex justify-center rounded-xl bg-muted/20 p-4">
                <ReceiptCanvas />
              </div>
              <p className="text-center text-[9px] text-muted-foreground">Drag to reorder · Click text to edit · Drag edges to resize</p>
            </div>
          </div>

          {/* Column 3: Stickers */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="p-4 h-[calc(100vh-8rem)] overflow-hidden">
              <StickerPanel />
            </Card>
          </div>
        </div>
      </main>

      {/* Print queue */}
      <PrintQueuePanel />
    </div>
  );
}
