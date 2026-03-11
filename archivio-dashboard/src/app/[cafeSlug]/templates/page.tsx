"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Image as KImage, Text as KText, Transformer, Group, Line } from "react-konva";
import Konva from "konva";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { GOOGLE_FONTS, loadGoogleFont, preloadAllFonts } from "@/lib/fonts";
import { BORDER_STYLES, type BorderStyle } from "@/lib/borders";
import { api } from "@/lib/api";
import { nanoid } from "nanoid";
import { generateShortCode } from "@/lib/short-code";
import { compressForUpload } from "@/lib/image-compress";
import { enqueueUpload, SHARE_SHORT_URL } from "@/lib/share-upload";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { AssetLibrary } from "@/components/asset-library";
import { useParams } from "next/navigation";
import { useBoothStore } from "@/store/booth-store";
import { useCafeConfig, initCafeConfigListener } from "@/lib/cafe-config";
import { toast } from "sonner";
import {
  Type, ImageIcon, Sticker, Square, QrCode, Trash2,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Save, FolderOpen, Plus, ArrowLeft,
  Printer, Copy, Layers, Wand2, Loader2, RotateCcw,
  Archive, Image as ImageLucide, Camera, Link2, Link2Off,
  X, Stamp, Settings,
} from "lucide-react";
import { InteractiveMenu, type InteractiveMenuItem } from "@/components/ui/modern-mobile-menu";
import QRCodeLib from "qrcode";

// ── Constants ──────────────────────────────────────────────
const BRIGHTNESS_PRESETS = [
  { value: "low", label: "Low", contrast: 1.15, brightness: 1.1 },
  { value: "medium", label: "Medium", contrast: 1.3, brightness: 1.25 },
  { value: "high", label: "High", contrast: 1.5, brightness: 1.4 },
];

const ALGORITHMS = [
  { value: "atkinson", label: "Film Grain", desc: "Classic aesthetic, retro Mac feel" },
  { value: "floyd_steinberg", label: "Fine Detail", desc: "Smooth gradients, natural photos" },
  { value: "stucki", label: "High Quality", desc: "Best for portraits, soft tones" },
  { value: "bayer8", label: "Newspaper", desc: "Bold crosshatch pattern, graphic" },
];

const STAGE_W = 280;
const PRINT_W = 576;
const PIXEL_RATIO = PRINT_W / STAGE_W;
const DEFAULT_H = 500;
const PRINTER_BUFFER_TOP = 15;
const AUTOSAVE_KEY = "archivio_tpl_autosave";
const TEMPLATE_BACKUP_KEY = "archivio_tpl_backups";

// ── Types ──────────────────────────────────────────────────
interface CanvasElement {
  id: string;
  type: "text" | "image" | "shape" | "qr" | "sticker" | "placeholder" | "logo";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  aspectLocked: boolean;
  label?: string;
  // Text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fill?: string;
  align?: string;
  // Image / Sticker / Logo
  src?: string;
  borderStyle?: string;
  // Shape
  shapeType?: "rect" | "circle" | "line";
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  shapeFill?: string;
  // QR
  qrUrl?: string;
  // Opacity
  opacity?: number;
}

function defaultAspectLocked(type: CanvasElement["type"]): boolean {
  return type === "image" || type === "logo" || type === "sticker" || type === "qr" || type === "placeholder";
}

interface TemplateBackup {
  id: string;
  name: string;
  timestamp: number;
  state: string;
}

// ── Hook: load image ──────────────────────────────────────
function useImage(src: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
    return () => { el.onload = null; el.onerror = null; };
  }, [src]);
  return img;
}

function useQRDataUrl(url: string | undefined, size: number): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setDataUrl(null); return; }
    const canvas = document.createElement("canvas");
    QRCodeLib.toCanvas(canvas, url, { width: size, margin: 2, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "M" }, (err) => {
      if (!err) setDataUrl(canvas.toDataURL("image/png"));
    });
  }, [url, size]);
  return dataUrl;
}

// ── BG Removal — shared utility ──────────────────────────
import { removeBackground } from "@/lib/bg-removal";

// ── Element renderer ──────────────────────────────────────
function ElementNode({ el, onSelect, onDragEnd, onDragMove, onTransformEnd }: {
  el: CanvasElement;
  onSelect: (id: string) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: Konva.KonvaEventObject<Event>) => void;
}) {
  const img = useImage(el.type === "image" || el.type === "sticker" || el.type === "logo" ? el.src : null);
  const qrDataUrl = useQRDataUrl(el.type === "qr" ? el.qrUrl : undefined, el.width);
  const qrImg = useImage(qrDataUrl);

  // Auto-select on drag start so transformer shows immediately when dragging
  const handleDragStart = () => {
    onSelect(el.id);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd?.(el.id, e.target.x(), e.target.y());
  };

  if (el.type === "text") {
    return (
      <KText
        id={el.id}
        name="element"
        x={el.x}
        y={el.y}
        width={el.width}
        text={el.text || "Text"}
        fontSize={el.fontSize || 14}
        fontFamily={el.fontFamily || "Inter"}
        fontStyle={el.fontStyle || "normal"}
        fill={el.fill || "#000000"}
        align={el.align || "left"}
        rotation={el.rotation}
        opacity={el.opacity ?? 1}
        draggable={!el.locked}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
        onTransformEnd={onTransformEnd}
      />
    );
  }

  if (el.type === "image" || el.type === "sticker" || el.type === "logo") {
    if (!img) return null;
    const border = BORDER_STYLES.find((b) => b.id === el.borderStyle) || BORDER_STYLES[0];
    const pad = border.padding || 0;
    const sw = border.strokeWidth;
    const hasBorder = !!border.stroke;

    return (
      <Group
        id={el.id}
        name="element"
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        opacity={el.opacity ?? 1}
        draggable={!el.locked}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragStart={handleDragStart}
        onDragEnd={(e) => onDragEnd?.(el.id, e.target.x(), e.target.y())}
        onDragMove={onDragMove}
        onTransformEnd={onTransformEnd}
      >
        {hasBorder && (
          <Rect
            x={-pad - sw}
            y={-pad - sw}
            width={el.width + pad * 2 + sw * 2}
            height={el.height + pad * 2 + sw * 2}
            stroke={border.stroke || undefined}
            strokeWidth={sw}
            dash={border.dash}
            cornerRadius={border.cornerRadius || 0}
            fill={border.id === "polaroid" ? "#ffffff" : undefined}
            listening={false}
          />
        )}
        <KImage
          image={img}
          x={0}
          y={0}
          width={el.width}
          height={el.height}
          cornerRadius={border.cornerRadius || 0}
        />
        {el.type === "logo" && (
          <React.Fragment>
            <Rect x={0} y={0} width={32} height={14} fill="rgba(0,0,0,0.55)" cornerRadius={[0, 0, 4, 0]} listening={false} />
            <KText x={2} y={1} text="LOGO" fontSize={9} fill="#fff" fontStyle="bold" fontFamily="monospace" listening={false} />
          </React.Fragment>
        )}
      </Group>
    );
  }

  if (el.type === "placeholder") {
    return (
      <Group
        id={el.id}
        name="element"
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        opacity={el.opacity ?? 1}
        draggable={!el.locked}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragStart={handleDragStart}
        onDragEnd={(e) => onDragEnd?.(el.id, e.target.x(), e.target.y())}
        onDragMove={onDragMove}
        onTransformEnd={onTransformEnd}
      >
        <Rect x={0} y={0} width={el.width} height={el.height} fill="#f0f0f0" stroke="#999" strokeWidth={2} dash={[6, 4]} cornerRadius={4} />
        <KText
          x={0}
          y={el.height / 2 - 16}
          width={el.width}
          text={"\u{1F4F7}"}
          fontSize={20}
          align="center"
          fill="#999"
          listening={false}
        />
        <KText
          x={0}
          y={el.height / 2 + 6}
          width={el.width}
          text={el.label || "Photo"}
          fontSize={10}
          fontFamily="monospace"
          align="center"
          fill="#888"
          listening={false}
        />
      </Group>
    );
  }

  if (el.type === "shape") {
    // For locked shapes, use hitFunc that only responds on the stroke/border area
    const hitFunc = el.locked ? (ctx: any, shape: any) => {
      const sw2 = (el.strokeWidth || 2) + 4; // small margin for easier selection
      ctx.beginPath();
      // Outer rect
      ctx.rect(-sw2, -sw2, el.width + sw2 * 2, el.height + sw2 * 2);
      // Inner rect (cut out)
      ctx.rect(sw2, sw2, el.width - sw2 * 2, el.height - sw2 * 2);
      ctx.fillStrokeShape(shape);
    } : undefined;

    return (
      <Rect
        id={el.id}
        name="element"
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        fill={el.shapeFill || "transparent"}
        stroke={el.stroke || "#000000"}
        strokeWidth={el.strokeWidth || 2}
        cornerRadius={el.cornerRadius || 0}
        opacity={el.opacity ?? 1}
        draggable={!el.locked}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
        onTransformEnd={onTransformEnd}
        hitFunc={hitFunc}
      />
    );
  }

  if (el.type === "qr") {
    if (!qrImg) return null;
    return (
      <KImage
        id={el.id}
        name="element"
        image={qrImg}
        x={el.x}
        y={el.y}
        width={el.width}
        height={el.height}
        rotation={el.rotation}
        opacity={el.opacity ?? 1}
        draggable={!el.locked}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragMove={onDragMove}
        onTransformEnd={onTransformEnd}
      />
    );
  }

  return null;
}

// ── Main Page ──────────────────────────────────────────────
let _uid = 0;
const uid = () => `el_${Date.now()}_${++_uid}`;

export default function TemplateEditorPage() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;

  useEffect(() => {
    useBoothStore.getState().setCafeSlug(cafeSlug);
  }, [cafeSlug]);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasH, setCanvasH] = useState(DEFAULT_H);
  const [backgroundSrc, setBackgroundSrc] = useState<string | null>(null);
  const bgImg = useImage(backgroundSrc);
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [copies, setCopies] = useState(1);
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; thumbnail: string }[]>([]);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);

  // Asset library from shared store
  const addAssetToStore = useBoothStore((s) => s.addAsset);
  const updateAssetInStore = useBoothStore((s) => s.updateAsset);

  // Print style settings (shared with dashboard for coherent output)
  const algorithm = useBoothStore((s) => s.algorithm);
  const printBrightness = useBoothStore((s) => s.printBrightness);
  const photoFilter = useBoothStore((s) => s.photoFilter);

  // Cafe config (feature flags + locked fields from platform)
  const can = useCafeConfig((s) => s.can);
  const isLocked = useCafeConfig((s) => s.isLocked);
  const maxCopies = useCafeConfig((s) => s.features.maxCopies);
  const canCreate = can("canCreateTemplate");

  // Initialize cafe config listener for platform iframe integration
  useEffect(() => { initCafeConfigListener(); }, []);

  // Sticker uploading state (full-screen loader with progress)
  const [stickerUploading, setStickerUploading] = useState(false);
  const [stickerProgress, setStickerProgress] = useState("Importing sticker...");

  // Template backups
  const [backups, setBackups] = useState<TemplateBackup[]>([]);

  const selectedEl = elements.find((e) => e.id === selectedId) || null;

  // ── Snap guides state ─────────────────────────────────
  const SNAP_THRESHOLD = 3;
  const [guideLines, setGuideLines] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  // ── Load persisted data on mount ──────────────────────
  useEffect(() => {
    // Load saved templates from server
    api.listTemplates().then(setSavedTemplates).catch(() => {});
    // Load backups from localStorage (backups persist across sessions)
    try {
      const stored = localStorage.getItem(TEMPLATE_BACKUP_KEY);
      if (stored) setBackups(JSON.parse(stored));
    } catch {}
    // Load autosaved state from sessionStorage (only within same browser session)
    // Unsaved templates do NOT persist across server/browser restarts
    try {
      const stored = sessionStorage.getItem(AUTOSAVE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.elements?.length > 0) {
          setElements(state.elements);
          setCanvasH(state.canvasH || DEFAULT_H);
          setCopies(state.copies || 1);
          setTemplateName(state.templateName || "Untitled Template");
          setCurrentTemplateId(state.currentTemplateId || null);
          if (state.backgroundSrc) setBackgroundSrc(state.backgroundSrc);
          toast.info("Restored auto-saved template");
        }
      }
    } catch {}
    // Clean up old localStorage autosave if it exists (migration)
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
  }, []);

  // ── Auto-save to sessionStorage on changes ──────────────
  // Uses sessionStorage so unsaved templates don't persist across browser/server restarts
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          elements, canvasH, copies, templateName, currentTemplateId, backgroundSrc,
        }));
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [elements, canvasH, copies, templateName, currentTemplateId, backgroundSrc]);

  // Persist backups
  useEffect(() => {
    try { localStorage.setItem(TEMPLATE_BACKUP_KEY, JSON.stringify(backups)); } catch {}
  }, [backups]);

  // Attach transformer — skip if element is locked (lock disables resize + drag)
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedId) {
      const el = elements.find((e) => e.id === selectedId);
      // Don't show transformer for locked elements — lock means no resize, no drag
      if (el && !el.locked) {
        const node = stage.findOne(`#${selectedId}`);
        if (node) {
          tr.nodes([node]);
          tr.getLayer()?.batchDraw();
          return;
        }
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  // ── Element CRUD ─────────────────────────────────────
  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  }, []);

  const removeElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // Keyboard shortcuts: Delete/Backspace removes selected element, Escape deselects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        const el = elements.find((x) => x.id === selectedId);
        if (el && !el.locked) {
          removeElement(selectedId);
        }
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, elements, removeElement]);

  const addText = () => {
    const el: CanvasElement = {
      id: uid(), type: "text", x: 40, y: canvasH / 2 - 20, width: 200, height: 30,
      rotation: 0, locked: false, aspectLocked: false, text: "New Text", fontSize: 16, fontFamily: "Inter",
      fontStyle: "normal", fill: "#000000", align: "center", opacity: 1,
    };
    setElements((prev) => [...prev, el]);
    // Use setTimeout to ensure the element is rendered before selecting
    setTimeout(() => setSelectedId(el.id), 50);
  };

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);

      // Load image to get real dimensions
      const img = new window.Image();
      img.onload = async () => {
        // Scale down to fit in canvas while preserving aspect ratio
        const maxW = STAGE_W * 0.8;
        const maxH = canvasH * 0.6;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;

        const el: CanvasElement = {
          id: uid(), type: "image", x: (STAGE_W - w) / 2, y: 20,
          width: w, height: h,
          rotation: 0, locked: false, aspectLocked: true, src: url, borderStyle: "none", opacity: 1,
        };
        setElements((prev) => [...prev, el]);
        setTimeout(() => setSelectedId(el.id), 50);

        // Add to shared asset library for reuse
        const assetId = `asset_${Date.now()}`;
        addAssetToStore({ id: assetId, src: url, name: file.name, type: "image" });

        // Upload to server
        try {
          const result = await api.uploadPhoto(file);
          const serverUrl = api.imageUrl(result.filename);
          updateElement(el.id, { src: serverUrl });
          updateAssetInStore(assetId, { src: serverUrl });
        } catch { /* keep local */ }
      };
      img.src = url;
    };
    input.click();
  };

  const addShape = () => {
    const el: CanvasElement = {
      id: uid(), type: "shape", x: 60, y: 60, width: 100, height: 80,
      rotation: 0, locked: false, aspectLocked: false, shapeType: "rect", stroke: "#000000",
      strokeWidth: 2, cornerRadius: 0, shapeFill: "transparent", opacity: 1,
    };
    setElements((prev) => [...prev, el]);
    setTimeout(() => setSelectedId(el.id), 50);
  };

  const addQR = () => {
    const el: CanvasElement = {
      id: uid(), type: "qr", x: 90, y: canvasH - 100, width: 80, height: 80,
      rotation: 0, locked: false, aspectLocked: true,
      qrUrl: SHARE_SHORT_URL ? `${SHARE_SHORT_URL}/preview` : "https://archivio.app",
      opacity: 1,
    };
    setElements((prev) => [...prev, el]);
    setTimeout(() => setSelectedId(el.id), 50);
  };

  const addSticker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);

      // Show full-screen loader with progress
      setStickerUploading(true);
      setStickerProgress("Starting import...");

      try {
        // Remove background first
        let finalUrl = url;
        try {
          finalUrl = await removeBackground(url, (msg) => setStickerProgress(msg));
          // Revoke old blob URL to free memory
          if (url !== finalUrl && url.startsWith("blob:")) URL.revokeObjectURL(url);
          toast.success("Background removed!");
        } catch (err) {
          console.error("[BG Removal] Failed:", err);
          setStickerProgress("BG removal failed, using original...");
          toast.warning("BG removal failed, using original image");
        }

        // Load to get real dimensions
        setStickerProgress("Loading image dimensions...");
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = finalUrl;
        });

        const maxW = STAGE_W * 0.4;
        const maxH = canvasH * 0.3;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;

        const elId = uid();
        const assetId = `asset_${Date.now()}`;
        const el: CanvasElement = {
          id: elId, type: "sticker", x: 40, y: 40, width: w, height: h,
          rotation: 0, locked: false, aspectLocked: true, src: finalUrl, borderStyle: "none", opacity: 1,
        };
        setElements((prev) => [...prev, el]);
        setTimeout(() => setSelectedId(elId), 50);

        // Add to shared asset library
        addAssetToStore({ id: assetId, src: finalUrl, name: file.name, type: "sticker" });

        // Upload to server in background
        try {
          const result = await api.uploadSticker(file);
          const serverUrl = `${api.base}/api/stickers/${result.filename}`;
          updateElement(elId, { src: serverUrl });
          updateAssetInStore(assetId, { src: serverUrl });
        } catch { /* keep local */ }
      } catch (err) {
        console.error("[Sticker Import] Failed:", err);
        toast.error("Failed to import sticker");
      } finally {
        setStickerUploading(false);
      }
    };
    input.click();
  };

  const addPlaceholder = () => {
    const el: CanvasElement = {
      id: uid(), type: "placeholder", x: (STAGE_W - 120) / 2, y: canvasH / 2 - 80,
      width: 120, height: 160, rotation: 0, locked: false, aspectLocked: true,
      label: "Photo", opacity: 1,
    };
    setElements((prev) => [...prev, el]);
    setTimeout(() => setSelectedId(el.id), 50);
  };

  const addLogo = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = async () => {
        const maxW = STAGE_W * 0.4;
        const maxH = canvasH * 0.25;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;
        const el: CanvasElement = {
          id: uid(), type: "logo", x: 10, y: 10, width: w, height: h,
          rotation: 0, locked: false, aspectLocked: true, src: url, borderStyle: "none", opacity: 1,
        };
        setElements((prev) => [...prev, el]);
        setTimeout(() => setSelectedId(el.id), 50);
        try {
          const result = await api.uploadPhoto(file);
          const serverUrl = api.imageUrl(result.filename);
          updateElement(el.id, { src: serverUrl });
        } catch {}
      };
      img.src = url;
    };
    input.click();
  };

  const uploadBackground = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setBackgroundSrc(url);
      try {
        const result = await api.uploadPhoto(file);
        setBackgroundSrc(api.imageUrl(result.filename));
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      } catch {}
    };
    input.click();
  };

  // Add asset from library to canvas again — loads real dimensions
  const addAssetToCanvas = useCallback((asset: { id: string; src: string; name: string; type: "image" | "sticker" }) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = asset.type === "sticker" ? STAGE_W * 0.4 : STAGE_W * 0.8;
      const maxH = asset.type === "sticker" ? canvasH * 0.3 : canvasH * 0.6;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      const el: CanvasElement = {
        id: uid(),
        type: asset.type,
        x: Math.random() * 40 + 20,
        y: Math.random() * 40 + 20,
        width: w,
        height: h,
        rotation: 0,
        locked: false,
        aspectLocked: defaultAspectLocked(asset.type),
        src: asset.src,
        borderStyle: "none",
        opacity: 1,
      };
      setElements((prev) => [...prev, el]);
      setTimeout(() => setSelectedId(el.id), 50);
    };
    img.onerror = () => {
      const el: CanvasElement = {
        id: uid(),
        type: asset.type,
        x: Math.random() * 40 + 20,
        y: Math.random() * 40 + 20,
        width: asset.type === "sticker" ? 80 : 200,
        height: asset.type === "sticker" ? 80 : 150,
        rotation: 0,
        locked: false,
        aspectLocked: defaultAspectLocked(asset.type),
        src: asset.src,
        borderStyle: "none",
        opacity: 1,
      };
      setElements((prev) => [...prev, el]);
      setTimeout(() => setSelectedId(el.id), 50);
    };
    img.src = asset.src;
  }, [canvasH]);

  // ── Layer ordering ─────────────────────────────────
  const moveLayer = useCallback((dir: "up" | "down" | "top" | "bottom") => {
    if (!selectedId) return;
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === selectedId);
      if (idx === -1) return prev;
      const arr = [...prev];
      if (dir === "up" && idx < arr.length - 1) { [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; }
      else if (dir === "down" && idx > 0) { [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; }
      else if (dir === "top") { arr.push(arr.splice(idx, 1)[0]); }
      else if (dir === "bottom") { arr.unshift(arr.splice(idx, 1)[0]); }
      return arr;
    });
  }, [selectedId]);

  // ── Transform handler (with text font size scaling) ──
  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const id = node.id();
    const sx = node.scaleX();
    const sy = node.scaleY();

    const el = elements.find((x) => x.id === id);

    // For Groups (image/sticker with border), width() returns what we set (el.width).
    // For standalone nodes (text, shape, qr), width() returns the actual node width.
    // In both cases: newSize = currentWidth * scale
    const currentW = el ? el.width : node.width();
    const currentH = el ? el.height : node.height();
    const newW = Math.max(10, currentW * sx);
    const newH = Math.max(10, currentH * sy);

    // Read position BEFORE resetting scale
    const newX = node.x();
    const newY = node.y();

    // Reset scale on the node to prevent visual doubling on re-render
    node.scaleX(1);
    node.scaleY(1);
    // Also update node dimensions so it doesn't flash at old size
    node.width(newW);
    node.height(newH);

    const updates: Partial<CanvasElement> = {
      x: newX,
      y: newY,
      width: newW,
      height: newH,
      rotation: node.rotation(),
    };

    // For text elements, also scale the font size proportionally
    if (el?.type === "text") {
      const avgScale = (Math.abs(sx) + Math.abs(sy)) / 2;
      const oldSize = el.fontSize || 14;
      const newSize = Math.max(6, Math.min(120, Math.round(oldSize * avgScale)));
      updates.fontSize = newSize;
    }

    updateElement(id, updates);
  }, [updateElement, elements]);

  // Snap guides: compute snap targets during drag
  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const id = node.id();
    const box = node.getClientRect({ relativeTo: node.getParent() ?? undefined });

    const dragEdges = {
      left: box.x, right: box.x + box.width, centerX: box.x + box.width / 2,
      top: box.y, bottom: box.y + box.height, centerY: box.y + box.height / 2,
    };

    const snapX: number[] = [0, STAGE_W, STAGE_W / 2];
    const snapY: number[] = [0, canvasH, canvasH / 2];

    for (const el of elements) {
      if (el.id === id) continue;
      snapX.push(el.x, el.x + el.width, el.x + el.width / 2);
      snapY.push(el.y, el.y + el.height, el.y + el.height / 2);
    }

    const activeX: number[] = [];
    const activeY: number[] = [];
    let dx = 0, dy = 0;

    for (const dp of [dragEdges.left, dragEdges.centerX, dragEdges.right]) {
      if (dx !== 0) break;
      for (const tp of snapX) {
        if (Math.abs(dp - tp) < SNAP_THRESHOLD) {
          dx = tp - dp;
          activeX.push(tp);
          break;
        }
      }
    }

    for (const dp of [dragEdges.top, dragEdges.centerY, dragEdges.bottom]) {
      if (dy !== 0) break;
      for (const tp of snapY) {
        if (Math.abs(dp - tp) < SNAP_THRESHOLD) {
          dy = tp - dp;
          activeY.push(tp);
          break;
        }
      }
    }

    if (dx !== 0 || dy !== 0) {
      node.position({ x: node.x() + dx, y: node.y() + dy });
    }

    setGuideLines({ x: activeX, y: activeY });
  }, [elements, canvasH]);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    updateElement(id, { x, y });
    setGuideLines({ x: [], y: [] });
  }, [updateElement]);

  // ── Backup system ────────────────────────────────────
  const createBackup = useCallback(() => {
    if (elements.length === 0) return;
    const backup: TemplateBackup = {
      id: `backup_${Date.now()}`,
      name: templateName || "Untitled",
      timestamp: Date.now(),
      state: JSON.stringify({ elements, canvasH, copies, backgroundSrc }),
    };
    setBackups((prev) => [backup, ...prev].slice(0, 20));
    return backup;
  }, [elements, canvasH, copies, templateName, backgroundSrc]);

  const restoreBackup = useCallback((backup: TemplateBackup) => {
    try {
      const state = JSON.parse(backup.state);
      setElements(state.elements || []);
      setCanvasH(state.canvasH || DEFAULT_H);
      setCopies(state.copies || 1);
      setBackgroundSrc(state.backgroundSrc || null);
      setTemplateName(backup.name);
      setSelectedId(null);
      toast.success(`Restored: ${backup.name}`);
    } catch {
      toast.error("Failed to restore backup");
    }
  }, []);

  const deleteBackup = useCallback((id: string) => {
    setBackups((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // ── Save / Load ────────────────────────────────────
  const handleSave = useCallback(async () => {
    const state = JSON.stringify({ elements, canvasH, copies, backgroundSrc });
    let thumbnailFile = "";
    // Export a small thumbnail
    try {
      const stage = stageRef.current;
      if (stage) {
        const dataUrl = stage.toDataURL({ pixelRatio: 0.5, mimeType: "image/png" });
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const uploaded = await api.uploadThumbnail(blob);
        thumbnailFile = uploaded.filename;
      }
    } catch { /* no thumbnail */ }

    try {
      if (currentTemplateId) {
        // Update existing template
        await api.updateTemplate(currentTemplateId, {
          name: templateName,
          state,
          thumbnail: thumbnailFile || undefined,
        });
        toast.success(`Template updated: ${templateName}`);
      } else {
        // Save new template
        const result = await api.saveTemplate(templateName, state, thumbnailFile);
        setCurrentTemplateId(result.id);
        toast.success(`Template saved: ${templateName}`);
      }
      // Also update sessionStorage autosave
      try {
        sessionStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          elements, canvasH, copies, templateName, currentTemplateId, backgroundSrc,
        }));
      } catch {}
      const templates = await api.listTemplates();
      setSavedTemplates(templates);
    } catch (err: any) {
      // Server unavailable — save to localStorage only
      toast.warning(`Server save failed — saved locally. ${err?.message || ""}`);
      createBackup();
    }
  }, [elements, canvasH, copies, templateName, currentTemplateId, backgroundSrc, createBackup]);

  const handleLoad = useCallback(async (tplId: string) => {
    try {
      // Auto-backup current work before loading a different template
      if (elements.length > 0) {
        createBackup();
      }
      const tpl = await api.getTemplate(tplId);
      const state = JSON.parse(tpl.state);
      setElements(state.elements || []);
      setCanvasH(state.canvasH || DEFAULT_H);
      setCopies(state.copies || 1);
      setBackgroundSrc(state.backgroundSrc || null);
      setTemplateName(tpl.name);
      setCurrentTemplateId(tplId);
      setSelectedId(null);
      setTemplateListOpen(false);
      toast.success(`Loaded: ${tpl.name}`);
    } catch (err: any) {
      toast.error(`Load failed: ${err?.message || "Unknown error"}`);
    }
  }, [elements, createBackup]);

  const handleDeleteTemplate = useCallback(async (tplId: string) => {
    try {
      await api.deleteTemplate(tplId);
      setSavedTemplates((prev) => prev.filter((t) => t.id !== tplId));
      if (currentTemplateId === tplId) setCurrentTemplateId(null);
      toast.success("Template deleted");
    } catch { toast.error("Delete failed"); }
  }, [currentTemplateId]);

  // New template with backup
  const handleNew = useCallback(() => {
    if (elements.length > 0) {
      createBackup();
      toast.info("Current progress backed up");
    }
    setElements([]);
    setBackgroundSrc(null);
    setTemplateName("Untitled Template");
    setCurrentTemplateId(null);
    setSelectedId(null);
  }, [elements.length, createBackup]);

  // ── Print ──────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setSelectedId(null);
    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer()?.batchDraw();
    await new Promise((r) => setTimeout(r, 100));

    const boothState = useBoothStore.getState();
    const hasQR = elements.some((el) => el.type === "qr");
    const useArchivioShare = hasQR && boothState.qrDestination === "archivio-share" && !!SHARE_SHORT_URL;

    let qrMeta: { photoId: string; shortCode: string } | null = null;

    if (useArchivioShare) {
      const photoId = nanoid();
      const shortCode = generateShortCode();
      qrMeta = { photoId, shortCode };
      const newUrl = `${SHARE_SHORT_URL}/${cafeSlug}/s/${shortCode}`;
      setElements((prev) => prev.map((el) =>
        el.type === "qr" ? { ...el, qrUrl: newUrl } : el
      ));
      await new Promise((r) => setTimeout(r, 300));
    }

    const dataUrl = stage.toDataURL({ pixelRatio: PIXEL_RATIO, mimeType: "image/png" });
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const preset = BRIGHTNESS_PRESETS.find((p) => p.value === boothState.printBrightness) || BRIGHTNESS_PRESETS[1];

    for (let i = 0; i < copies; i++) {
      const jobId = `tpl_${Date.now()}_${i}`;
      try {
        await api.printImage(blob, jobId, {
          algorithm: boothState.algorithm,
          contrast: preset.contrast,
          brightness: preset.brightness,
        });
        toast.success(`Print ${i + 1}/${copies} queued`);
      } catch (err: any) {
        toast.error(`Print failed: ${err?.message || "Error"}`);
      }
    }

    if (useArchivioShare && qrMeta) {
      try {
        const compressed = await compressForUpload(blob);
        await enqueueUpload(qrMeta.photoId, qrMeta.shortCode, compressed.original, compressed.thumbnail, compressed.social, null, cafeSlug);
      } catch { /* upload will retry from queue */ }
    }

    try {
      await api.saveToGallery(blob, "template_render");
    } catch { /* ignore */ }
  }, [copies, elements]);

  // ── Stage click ────────────────────────────────────
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") {
      setSelectedId(null);
    }
  };

  // ── Double-click text editing ──────────────────────
  const handleTextDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const textNode = e.target as Konva.Text;
    const stage = stageRef.current;
    const el = elements.find((x) => x.id === textNode.id());
    if (!stage || !el) return;

    textNode.hide();
    const layer = textNode.getLayer();
    layer?.batchDraw();

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.value = el.text || "";
    textarea.style.position = "fixed";
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${textNode.width() * textNode.scaleX()}px`;
    textarea.style.height = `${textNode.height() * textNode.scaleY() + 10}px`;
    textarea.style.fontSize = `${el.fontSize || 14}px`;
    textarea.style.fontFamily = el.fontFamily || "Inter";
    textarea.style.border = "2px solid #C4956A";
    textarea.style.borderRadius = "4px";
    textarea.style.padding = "2px 4px";
    textarea.style.outline = "none";
    textarea.style.background = "white";
    textarea.style.color = "black";
    textarea.style.zIndex = "10000";
    textarea.style.resize = "none";
    textarea.focus();

    const finish = () => {
      updateElement(el.id, { text: textarea.value });
      textarea.remove();
      textNode.show();
      layer?.batchDraw();
    };
    textarea.addEventListener("blur", finish);
    textarea.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { textarea.value = el.text || ""; finish(); }
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); finish(); }
    });
  };

  // ── Right-side Panel: Properties + Asset Library ───
  const renderPropertiesPanel = (isMobile = false) => {
    const containerCls = isMobile ? "" : "space-y-3";

    return (
      <div className={containerCls}>
        {/* Properties Card */}
        <Card className="p-3 space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {selectedEl ? `${selectedEl.type.charAt(0).toUpperCase() + selectedEl.type.slice(1)} Properties` : "Properties"}
          </Label>

          {!selectedEl && (
            <p className="text-[10px] text-muted-foreground">Select an element to edit its properties</p>
          )}

          {/* Text properties */}
          {selectedEl?.type === "text" && (
            <div className="space-y-2">
              <Input
                value={selectedEl.text || ""}
                onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                className="text-xs h-7"
                placeholder="Text content..."
              />
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-8 shrink-0">Size</Label>
                <Slider
                  value={[selectedEl.fontSize || 14]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { fontSize: v })}
                  min={6}
                  max={120}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[10px] w-6 text-right">{selectedEl.fontSize}</span>
              </div>
              {can("canChangeFont") && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] hover:bg-muted w-full justify-between">
                    <Type className="h-3 w-3 text-muted-foreground" />
                    <span style={{ fontFamily: `"${selectedEl.fontFamily}", sans-serif` }}>
                      {selectedEl.fontFamily}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1" align="start" onOpenAutoFocus={() => preloadAllFonts()}>
                  <ScrollArea className="h-48">
                    {GOOGLE_FONTS.map((f) => (
                      <button
                        key={f.name}
                        onMouseEnter={() => loadGoogleFont(f.name)}
                        className={`block w-full rounded px-2 py-1 text-left text-[10px] hover:bg-muted ${f.name === selectedEl.fontFamily ? "bg-muted font-semibold" : ""}`}
                        style={{ fontFamily: `"${f.name}", sans-serif` }}
                        onClick={() => { loadGoogleFont(f.name); updateElement(selectedEl.id, { fontFamily: f.name }); }}
                      >
                        {f.name}
                        <span className="ml-1 text-[8px] uppercase text-muted-foreground">{f.category}</span>
                      </button>
                    ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              )}
              <div className="flex gap-1">
                <Button
                  variant={selectedEl.fontStyle?.includes("bold") ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] flex-1"
                  onClick={() => {
                    const current = selectedEl.fontStyle || "normal";
                    const hasBold = current.includes("bold");
                    const hasItalic = current.includes("italic");
                    updateElement(selectedEl.id, { fontStyle: `${hasBold ? "" : "bold"} ${hasItalic ? "italic" : ""}`.trim() || "normal" });
                  }}
                >
                  B
                </Button>
                <Button
                  variant={selectedEl.fontStyle?.includes("italic") ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] flex-1 italic"
                  onClick={() => {
                    const current = selectedEl.fontStyle || "normal";
                    const hasBold = current.includes("bold");
                    const hasItalic = current.includes("italic");
                    updateElement(selectedEl.id, { fontStyle: `${hasBold ? "bold" : ""} ${hasItalic ? "" : "italic"}`.trim() || "normal" });
                  }}
                >
                  I
                </Button>
              </div>
              <Select value={selectedEl.align || "left"} onValueChange={(v) => updateElement(selectedEl.id, { align: v })}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-8 shrink-0">Color</Label>
                <input
                  type="color"
                  value={selectedEl.fill || "#000000"}
                  onChange={(e) => updateElement(selectedEl.id, { fill: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border p-0"
                />
                <span className="text-[10px] text-muted-foreground font-mono">{selectedEl.fill || "#000000"}</span>
              </div>
            </div>
          )}

          {/* Image / Sticker / Logo properties */}
          {(selectedEl?.type === "image" || selectedEl?.type === "sticker" || selectedEl?.type === "logo") && can("canChangeBorder") && (
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Border Style</Label>
              <Select
                value={selectedEl.borderStyle || "none"}
                onValueChange={(v) => updateElement(selectedEl.id, { borderStyle: v })}
              >
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_STYLES.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-[10px]">
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Shape properties */}
          {selectedEl?.type === "shape" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Stroke</Label>
                <Slider
                  value={[selectedEl.strokeWidth || 2]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { strokeWidth: v })}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Radius</Label>
                <Slider
                  value={[selectedEl.cornerRadius || 0]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { cornerRadius: v })}
                  min={0}
                  max={50}
                  step={2}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Border</Label>
                <input
                  type="color"
                  value={selectedEl.stroke || "#000000"}
                  onChange={(e) => updateElement(selectedEl.id, { stroke: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border p-0"
                />
                <span className="text-[10px] text-muted-foreground font-mono">{selectedEl.stroke || "#000000"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Fill</Label>
                <input
                  type="color"
                  value={selectedEl.shapeFill === "transparent" ? "#ffffff" : (selectedEl.shapeFill || "#ffffff")}
                  onChange={(e) => updateElement(selectedEl.id, { shapeFill: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border p-0"
                />
                <Button
                  variant={selectedEl.shapeFill === "transparent" ? "default" : "outline"}
                  size="sm"
                  className="h-5 text-[9px] px-1.5"
                  onClick={() => updateElement(selectedEl.id, { shapeFill: selectedEl.shapeFill === "transparent" ? "#ffffff" : "transparent" })}
                >
                  {selectedEl.shapeFill === "transparent" ? "No fill" : "Fill"}
                </Button>
              </div>
            </div>
          )}

          {/* QR properties */}
          {selectedEl?.type === "qr" && (
            <div className="space-y-2">
              <Input
                value={selectedEl.qrUrl || ""}
                onChange={(e) => updateElement(selectedEl.id, { qrUrl: e.target.value })}
                className="text-xs h-7 font-mono"
                placeholder="https://..."
              />
            </div>
          )}

          {/* Placeholder properties */}
          {selectedEl?.type === "placeholder" && (
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground">Label</Label>
              <Input
                value={selectedEl.label || ""}
                onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })}
                className="text-xs h-7"
                placeholder="e.g. Main Photo"
              />
            </div>
          )}

          {/* Rotation + aspect-lock for all elements */}
          {selectedEl && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground w-8 shrink-0">Rot.</Label>
                <Slider
                  value={[selectedEl.rotation || 0]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { rotation: v })}
                  min={-180}
                  max={180}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">{Math.round(selectedEl.rotation || 0)}°</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant={selectedEl.aspectLocked ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[9px] gap-1 flex-1"
                  onClick={() => updateElement(selectedEl.id, { aspectLocked: !selectedEl.aspectLocked })}
                >
                  {selectedEl.aspectLocked ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                  {selectedEl.aspectLocked ? "Ratio locked" : "Ratio unlocked"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Shared Asset Library */}
        {!isMobile && (
          <Card className="p-3 overflow-visible">
            <AssetLibrary onAddToCanvas={addAssetToCanvas} cols={2} maxHeight="max-h-64" />
          </Card>
        )}

        {/* Template Backups */}
        {!isMobile && backups.length > 0 && (
          <Card className="p-3 space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Backups
            </Label>
            <ScrollArea className="max-h-32">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center gap-1.5 rounded p-1 hover:bg-muted cursor-pointer group text-[10px]" onClick={() => restoreBackup(b)}>
                  <Archive className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{b.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(b.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteBackup(b.id); }}
                  >
                    <Trash2 className="h-2 w-2" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticker uploading overlay with live progress */}
      {stickerUploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-xl bg-card border max-w-xs">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Importing Sticker</p>
            <p className="text-xs text-muted-foreground text-center animate-pulse">{stickerProgress}</p>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-12 md:h-14 max-w-7xl items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Link href={`/${cafeSlug}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Dashboard</span>
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm md:text-lg font-bold tracking-tight">Template Editor</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link href={`/${cafeSlug}/gallery`}>
              <Button variant="outline" size="sm" className="text-xs h-7 md:h-8">
                <Layers className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Gallery</span>
              </Button>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-3 md:px-4 py-4 md:py-6">
        <div className="grid gap-4 md:gap-6 md:grid-cols-[280px_1fr] lg:grid-cols-[240px_1fr_280px]">
          {/* Left: Add Elements + Saved Templates */}
          <div className="space-y-3 order-2 md:order-1">
            {/* Add Elements toolbar */}
            <Card className="p-3">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Add Element</Label>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addText}>
                  <Type className="h-3 w-3" /> Text
                </Button>
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addImage}>
                  <ImageIcon className="h-3 w-3" /> Image
                </Button>
                {can("canUseStickers") && (
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addSticker}>
                  <Sticker className="h-3 w-3" /> Sticker
                </Button>
                )}
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addShape}>
                  <Square className="h-3 w-3" /> Shape
                </Button>
                {can("canEditQr") && (
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addQR}>
                  <QrCode className="h-3 w-3" /> QR Code
                </Button>
                )}
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addPlaceholder}>
                  <Camera className="h-3 w-3" /> Photo Box
                </Button>
                <Button variant="outline" size="sm" className="text-[10px] h-8 gap-1" onClick={addLogo}>
                  <Stamp className="h-3 w-3" /> Logo
                </Button>
              </div>
              <Separator className="my-2" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-8 gap-1 flex-1"
                  onClick={uploadBackground}
                >
                  <ImageLucide className="h-3 w-3" /> {backgroundSrc ? "Change BG" : "Upload BG"}
                </Button>
                {backgroundSrc && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-8 gap-1 text-destructive"
                    onClick={() => setBackgroundSrc(null)}
                  >
                    <X className="h-3 w-3" /> Remove
                  </Button>
                )}
              </div>
            </Card>

            {/* Print Style */}
            <Card className="p-3 space-y-3">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Print Style</Label>
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground">Dithering</Label>
                <Select value={algorithm} onValueChange={(v) => useBoothStore.getState().setAlgorithm(v)}>
                  <SelectTrigger className="text-xs h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITHMS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-xs">
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-[10px] text-muted-foreground">Brightness</Label>
                <ToggleGroup
                  type="single"
                  value={printBrightness}
                  onValueChange={(v) => { if (v) useBoothStore.getState().setPrintBrightness(v); }}
                  size="sm"
                  className="w-full"
                >
                  {BRIGHTNESS_PRESETS.map((p) => (
                    <ToggleGroupItem key={p.value} value={p.value} className="text-[10px] px-2 h-6 flex-1">
                      {p.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Label className="text-[10px] text-muted-foreground">Photo filter</Label>
                <Select value={photoFilter} onValueChange={(v) => useBoothStore.getState().setPhotoFilter(v)}>
                  <SelectTrigger className="text-xs h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Standard B&W</SelectItem>
                    <SelectItem value="sepia" className="text-xs">Warm Sepia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Layer ordering */}
            {selectedEl && (
              <Card className="p-3 space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Layer</Label>
                <div className="flex gap-1 flex-wrap">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveLayer("bottom")}>
                    <ChevronsDown className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveLayer("down")}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveLayer("up")}>
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => moveLayer("top")}>
                    <ChevronsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateElement(selectedEl.id, { locked: !selectedEl.locked })}
                    title={selectedEl.locked ? "Unlock position" : "Lock position"}
                  >
                    {selectedEl.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant={selectedEl.aspectLocked ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateElement(selectedEl.id, { aspectLocked: !selectedEl.aspectLocked })}
                    title={selectedEl.aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                  >
                    {selectedEl.aspectLocked ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeElement(selectedEl.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Opacity */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Opacity</Label>
                  <Slider
                    value={[(selectedEl.opacity ?? 1) * 100]}
                    onValueChange={([v]) => updateElement(selectedEl.id, { opacity: v / 100 })}
                    min={5}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-muted-foreground w-6 text-right">{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
                </div>
              </Card>
            )}

            {/* Saved templates */}
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Templates</Label>
                {canCreate && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleNew}>
                  <Plus className="h-3 w-3 mr-1" /> New
                </Button>
                )}
              </div>
              <ScrollArea className="h-40 md:h-60">
                {savedTemplates.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4">No saved templates yet</p>
                )}
                {savedTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`flex items-center gap-2 rounded p-1.5 hover:bg-muted cursor-pointer group ${currentTemplateId === tpl.id ? "bg-muted ring-1 ring-primary" : ""}`}
                    onClick={() => handleLoad(tpl.id)}
                  >
                    <div className="w-10 h-14 rounded border bg-muted/50 shrink-0 overflow-hidden flex items-center justify-center">
                      {tpl.thumbnail ? (
                        <img src={api.previewUrl(tpl.thumbnail)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Layers className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{tpl.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </Card>
          </div>

          {/* Center: Canvas */}
          <div className="order-1 md:order-2">
            {/* Name + Save bar */}
            <div className="flex items-center gap-2 mb-3">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="text-sm font-medium h-8 flex-1"
                placeholder="Template name..."
              />
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleSave}
                disabled={!currentTemplateId && !canCreate}
                title={!currentTemplateId && !canCreate ? "Template creation is disabled" : undefined}
              >
                <Save className="h-3 w-3" /> Save
              </Button>
            </div>

            {/* Canvas height slider */}
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-[10px] text-muted-foreground w-12 shrink-0">Height</Label>
              <Slider
                value={[canvasH]}
                onValueChange={([v]) => setCanvasH(v)}
                min={200}
                max={1200}
                step={10}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground w-8 text-right">{canvasH}px</span>
            </div>

            <div className="flex justify-center rounded-xl bg-muted/20 p-2 overflow-x-auto">
              <Stage
                ref={stageRef}
                width={STAGE_W}
                height={canvasH}
                onClick={handleStageClick}
                onTap={handleStageClick}
                style={{ cursor: "default" }}
              >
                <Layer>
                  <Rect name="bg" x={0} y={0} width={STAGE_W} height={canvasH} fill="#ffffff" stroke="#d0d0d0" strokeWidth={1} />

                  {bgImg && (
                    <KImage
                      name="bg"
                      image={bgImg}
                      x={0}
                      y={0}
                      width={STAGE_W}
                      height={canvasH}
                      listening={false}
                    />
                  )}

                  {/* Printer buffer zone indicator (fixed, not user-configurable) */}
                  <Rect
                    x={0}
                    y={0}
                    width={STAGE_W}
                    height={PRINTER_BUFFER_TOP}
                    fill="rgba(255,180,120,0.75)"
                    listening={false}
                  />
                  <Rect
                    x={0}
                    y={PRINTER_BUFFER_TOP}
                    width={STAGE_W}
                    height={0}
                    stroke="rgba(180,120,60,0.5)"
                    strokeWidth={0.5}
                    dash={[3, 3]}
                    listening={false}
                  />
                  <KText
                    x={4}
                    y={1}
                    text="printer unprintable area"
                    fontSize={7}
                    fill="rgba(140,90,40,0.6)"
                    fontFamily="monospace"
                    listening={false}
                  />

                  {elements.map((el) => (
                    <ElementNode
                      key={el.id}
                      el={el}
                      onSelect={setSelectedId}
                      onDragEnd={handleDragEnd}
                      onDragMove={handleDragMove}
                      onTransformEnd={handleTransformEnd}
                    />
                  ))}

                  {guideLines.x.map((gx, i) => (
                    <Line key={`gx-${i}`} points={[gx, 0, gx, canvasH]} stroke="#0096FF" strokeWidth={0.5} dash={[4, 4]} listening={false} />
                  ))}
                  {guideLines.y.map((gy, i) => (
                    <Line key={`gy-${i}`} points={[0, gy, STAGE_W, gy]} stroke="#0096FF" strokeWidth={0.5} dash={[4, 4]} listening={false} />
                  ))}

                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    keepRatio={selectedEl?.aspectLocked ?? false}
                    enabledAnchors={
                      selectedEl?.aspectLocked
                        ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                        : ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
                    }
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 10 || newBox.height < 10) return oldBox;
                      return newBox;
                    }}
                    borderStroke="#C4956A"
                    borderStrokeWidth={2}
                    anchorStroke="#C4956A"
                    anchorFill="#ffffff"
                    anchorSize={10}
                    anchorCornerRadius={2}
                  />
                </Layer>
              </Stage>
            </div>

            {/* Print bar */}
            <div className="flex items-center gap-2 mt-3">
              {can("canChangeCopies") && (
              <div className="flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={String(copies)} onValueChange={(v) => setCopies(Number(v))}>
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.min(maxCopies || 5, 10) }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>x{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
              <Button className="flex-1 h-9 text-xs gap-1.5 gradient-warm text-white hover:brightness-110 rounded-lg" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" /> Print Template
              </Button>
            </div>

            {/* Mobile Asset Library */}
            <div className="lg:hidden mt-3">
              <Card className="p-3">
                <AssetLibrary onAddToCanvas={addAssetToCanvas} cols={4} maxHeight="max-h-40" />
              </Card>
            </div>
          </div>

          {/* Right: Properties Panel + Asset Library + Backups */}
          <div className="order-3 hidden lg:block">
            {renderPropertiesPanel()}
          </div>
        </div>
      </main>

      {/* Mobile bottom nav (visible below lg, hidden when element properties are open) */}
      {!selectedEl && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <InteractiveMenu
            items={[
              { label: "canvas", icon: ImageLucide },
              { label: "add", icon: Plus },
              { label: "templates", icon: Layers },
              { label: "print", icon: Printer },
            ] as InteractiveMenuItem[]}
            accentColor="var(--warm)"
            onItemClick={(_i, label) => {
              if (label === "print") { handlePrint(); return; }
              if (label === "add") { setTemplateListOpen(false); return; }
              if (label === "templates") { setTemplateListOpen(true); return; }
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}

      {/* Mobile properties sheet (below lg) */}
      {selectedEl && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t p-3 space-y-2 max-h-[40vh] overflow-y-auto">
            <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">{selectedEl.type.charAt(0).toUpperCase() + selectedEl.type.slice(1)}</Label>
            <div className="flex gap-1 flex-wrap">
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateElement(selectedEl.id, { locked: !selectedEl.locked })}>
                {selectedEl.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </Button>
              <Button
                variant={selectedEl.aspectLocked ? "default" : "outline"}
                size="icon"
                className="h-6 w-6"
                onClick={() => updateElement(selectedEl.id, { aspectLocked: !selectedEl.aspectLocked })}
              >
                {selectedEl.aspectLocked ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => moveLayer("down")}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => moveLayer("up")}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeElement(selectedEl.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {selectedEl.type === "text" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={selectedEl.text || ""}
                  onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                  className="text-xs h-7 flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground shrink-0">Size</Label>
                <Slider
                  value={[selectedEl.fontSize || 14]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { fontSize: v })}
                  min={6}
                  max={120}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[10px] w-5 text-right">{selectedEl.fontSize}</span>
              </div>
            </div>
          )}
          {(selectedEl.type === "image" || selectedEl.type === "sticker" || selectedEl.type === "logo") && can("canChangeBorder") && (
            <Select value={selectedEl.borderStyle || "none"} onValueChange={(v) => updateElement(selectedEl.id, { borderStyle: v })}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BORDER_STYLES.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-[10px]">{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedEl.type === "placeholder" && (
            <Input
              value={selectedEl.label || ""}
              onChange={(e) => updateElement(selectedEl.id, { label: e.target.value })}
              className="text-xs h-7"
              placeholder="Label e.g. Main Photo"
            />
          )}
          {selectedEl.type === "shape" && (
            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <Label className="text-[10px] shrink-0">Stroke</Label>
                <Slider
                  value={[selectedEl.strokeWidth || 2]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { strokeWidth: v })}
                  min={0} max={10} step={1}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <Label className="text-[10px] shrink-0">Radius</Label>
                <Slider
                  value={[selectedEl.cornerRadius || 0]}
                  onValueChange={([v]) => updateElement(selectedEl.id, { cornerRadius: v })}
                  min={0} max={50} step={2}
                  className="flex-1"
                />
              </div>
            </div>
          )}
          {selectedEl.type === "qr" && (
            <Input
              value={selectedEl.qrUrl || ""}
              onChange={(e) => updateElement(selectedEl.id, { qrUrl: e.target.value })}
              className="text-xs h-7 font-mono"
            />
          )}
          {/* Opacity (mobile) */}
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground shrink-0">Opacity</Label>
            <Slider
              value={[(selectedEl.opacity ?? 1) * 100]}
              onValueChange={([v]) => updateElement(selectedEl.id, { opacity: v / 100 })}
              min={5} max={100} step={5}
              className="flex-1"
            />
            <span className="text-[10px] w-6 text-right">{Math.round((selectedEl.opacity ?? 1) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
