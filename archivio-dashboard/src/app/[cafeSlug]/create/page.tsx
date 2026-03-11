"use client";

import { useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ReceiptCanvas, type ReceiptCanvasHandle } from "@/components/receipt-canvas";
import { useBoothStore } from "@/store/booth-store";
import { ImageDropzone } from "@/components/image-dropzone";
import { DeviceCameraButton } from "@/components/device-camera-button";
import { FontPicker } from "@/components/font-picker";
import { StickerPanel } from "@/components/sticker-panel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { BORDER_STYLES, type BorderStyle } from "@/lib/borders";
import { GOOGLE_FONTS, loadGoogleFont, preloadAllFonts } from "@/lib/fonts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Type, Sticker, Clock,
  Loader2, Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function CreatePage() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;
  const canvasRef = useRef<ReceiptCanvasHandle>(null);
  const [downloading, setDownloading] = useState(false);
  const [stickerSheetOpen, setStickerSheetOpen] = useState(false);

  const headerTextEnabled = useBoothStore((s) => s.headerTextEnabled);
  const headerText = useBoothStore((s) => s.headerText);
  const headerTextFont = useBoothStore((s) => s.headerTextFont);
  const headerTextSize = useBoothStore((s) => s.headerTextSize);
  const headerTextBold = useBoothStore((s) => s.headerTextBold);
  const headerTextItalic = useBoothStore((s) => s.headerTextItalic);
  const headerHeight = useBoothStore((s) => s.headerHeight);
  const photoPreview = useBoothStore((s) => s.photoPreview);
  const photoBorderId = useBoothStore((s) => s.photoBorderId);
  const photoFilter = useBoothStore((s) => s.photoFilter);
  const memo = useBoothStore((s) => s.memo);
  const qrEnabled = useBoothStore((s) => s.qrEnabled);
  const qrUrl = useBoothStore((s) => s.qrUrl);
  const dateStampEnabled = useBoothStore((s) => s.dateStampEnabled);
  const timeStampEnabled = useBoothStore((s) => s.timeStampEnabled);
  const locationStampEnabled = useBoothStore((s) => s.locationStampEnabled);
  const locationText = useBoothStore((s) => s.locationText);
  const algorithm = useBoothStore((s) => s.algorithm);
  const printBrightness = useBoothStore((s) => s.printBrightness);

  const hasPhoto = !!photoPreview;

  useEffect(() => { preloadAllFonts(); }, []);

  const handlePhotoUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    useBoothStore.getState().setPhoto(url, "");
    useBoothStore.getState().setPhotoOriginal(url);
  }, []);

  const handleDeviceCapture = useCallback((blob: Blob, url: string) => {
    useBoothStore.getState().setPhoto(url, "");
    useBoothStore.getState().setPhotoOriginal(url);
  }, []);

  const handleDownloadPNG = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await canvasRef.current?.exportImage();
      if (!blob) throw new Error("Export failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `archivio-receipt-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 md:h-14 max-w-7xl items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Link href={`/${cafeSlug}`} className="text-sm md:text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
              Archivio
            </Link>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <span className="text-xs text-muted-foreground hidden sm:inline">Create your own receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadPNG}
              disabled={!hasPhoto || downloading}
              className="h-8 gap-1.5 text-xs font-semibold gradient-warm text-white"
            >
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              {downloading ? "Exporting..." : "Download PNG"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-3 md:px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_280px] gap-4 md:gap-6">
          {/* Column 1: Controls */}
          <div className="space-y-4 md:max-w-md">
            {/* Photo Upload */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Photo
              </h3>
              <ImageDropzone
                label="Photo"
                hint="Drag a photo or click to browse"
                value={photoPreview}
                onDrop={handlePhotoUpload}
                onClear={() => useBoothStore.getState().clearPhoto()}
              />
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><Separator /></div>
                <span className="relative bg-card px-2 text-xs text-muted-foreground">or capture</span>
              </div>
              <DeviceCameraButton onCapture={handleDeviceCapture} />
              {hasPhoto && (
                <div className="flex gap-2">
                  <Select value={photoFilter} onValueChange={(v) => useBoothStore.getState().setPhotoFilter(v)}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Filter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Standard B&W</SelectItem>
                      <SelectItem value="sepia">Warm Sepia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={photoBorderId} onValueChange={(v) => useBoothStore.getState().setPhotoBorderId(v)}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Border" /></SelectTrigger>
                    <SelectContent>
                      {BORDER_STYLES.map((b: BorderStyle) => (
                        <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>

            {/* Header */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5" /> Header
                </h3>
                <Switch checked={headerTextEnabled} onCheckedChange={(v) => useBoothStore.getState().setHeaderTextEnabled(v)} />
              </div>
              {headerTextEnabled && (
                <div className="space-y-2">
                  <Input
                    value={headerText}
                    onChange={(e) => useBoothStore.getState().setHeaderText(e.target.value)}
                    placeholder="Your brand name..."
                    className="text-sm h-8"
                  />
                  <div className="flex gap-2 items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start gap-2 text-xs h-8">
                          <Type className="h-3 w-3 text-muted-foreground" />
                          <span style={{ fontFamily: `"${headerTextFont}", sans-serif` }}>{headerTextFont}</span>
                        </Button>
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
                    <Input
                      type="number"
                      value={headerTextSize}
                      onChange={(e) => useBoothStore.getState().setHeaderTextSize(Number(e.target.value))}
                      className="w-16 h-8 text-xs"
                      min={8}
                      max={40}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Height: {headerHeight}px</Label>
                    <Slider
                      value={[headerHeight]}
                      onValueChange={([v]) => useBoothStore.getState().setHeaderHeight(v)}
                      min={30}
                      max={150}
                      step={2}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Memo */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Memo</h3>
              <Textarea
                value={memo}
                onChange={(e) => useBoothStore.getState().setMemo(e.target.value)}
                placeholder="Add a message..."
                rows={2}
                className="text-sm resize-none"
              />
              <FontPicker />
            </Card>

            {/* QR Code */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">QR Code</h3>
                <Switch checked={qrEnabled} onCheckedChange={(v) => useBoothStore.getState().setQrEnabled(v)} />
              </div>
              {qrEnabled && (
                <Input
                  value={qrUrl}
                  onChange={(e) => useBoothStore.getState().setQrUrl(e.target.value)}
                  placeholder="https://your-link.com"
                  className="text-sm h-8"
                />
              )}
            </Card>

            {/* Stamps */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Stamps
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Date</Label>
                  <Switch checked={dateStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setDateStampEnabled(v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Time</Label>
                  <Switch checked={timeStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setTimeStampEnabled(v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Location</Label>
                  <Switch checked={locationStampEnabled} onCheckedChange={(v) => useBoothStore.getState().setLocationStampEnabled(v)} />
                </div>
                {locationStampEnabled && (
                  <Input
                    value={locationText}
                    onChange={(e) => useBoothStore.getState().setLocationText(e.target.value)}
                    placeholder="e.g. Seoul, Korea"
                    className="text-sm h-8"
                  />
                )}
              </div>
            </Card>

            {/* Print Settings */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Settings</h3>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Dithering</Label>
                  <ToggleGroup type="single" value={algorithm} onValueChange={(v) => { if (v) useBoothStore.getState().setAlgorithm(v); }} size="sm" className="w-full">
                    <ToggleGroupItem value="atkinson" className="text-[10px] flex-1 h-7">Atkinson</ToggleGroupItem>
                    <ToggleGroupItem value="floyd_steinberg" className="text-[10px] flex-1 h-7">Floyd</ToggleGroupItem>
                    <ToggleGroupItem value="stucki" className="text-[10px] flex-1 h-7">Stucki</ToggleGroupItem>
                    <ToggleGroupItem value="bayer8" className="text-[10px] flex-1 h-7">Bayer</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Brightness</Label>
                  <ToggleGroup type="single" value={printBrightness} onValueChange={(v) => { if (v) useBoothStore.getState().setPrintBrightness(v); }} size="sm" className="w-full">
                    <ToggleGroupItem value="medium" className="text-[10px] flex-1 h-7">Medium</ToggleGroupItem>
                    <ToggleGroupItem value="high" className="text-[10px] flex-1 h-7">High</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </Card>

            {/* Download button (mobile/tablet) */}
            <div className="md:hidden">
              <Button
                onClick={handleDownloadPNG}
                disabled={!hasPhoto || downloading}
                className="w-full h-12 text-base font-bold gradient-warm text-white"
              >
                {downloading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Download className="h-5 w-5 mr-2" />}
                {downloading ? "Exporting..." : "Download PNG"}
              </Button>
            </div>
          </div>

          {/* Column 2: Receipt Preview */}
          <div className="md:sticky md:top-16 md:self-start">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</h2>
                <span className="text-[9px] text-muted-foreground tracking-wide">80mm thermal receipt</span>
              </div>
              <div className="flex justify-center rounded-lg bg-muted/30 p-0 overflow-hidden">
                <ReceiptCanvas ref={canvasRef} />
              </div>
              <p className="text-center text-[9px] text-muted-foreground hidden md:block">Click to select · Drag to move</p>
            </div>
          </div>

          {/* Column 3: Stickers */}
          <div className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
            <Card className="p-4 h-[calc(100vh-8rem)] overflow-hidden">
              <StickerPanel />
            </Card>
          </div>
        </div>
      </main>

      {/* Mobile sticker sheet */}
      <div className="lg:hidden">
        <Sheet open={stickerSheetOpen} onOpenChange={setStickerSheetOpen}>
          <SheetTrigger asChild>
            <button className="fixed bottom-4 right-4 z-40 rounded-full bg-primary p-3 text-primary-foreground">
              <Sticker className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh]">
            <SheetTitle className="sr-only">Stickers</SheetTitle>
            <StickerPanel />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
