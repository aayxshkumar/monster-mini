"use client";

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Rect, Image as KImage, Text as KText, Transformer, Group } from "react-konva";
import Konva from "konva";
import { useBoothStore, type GridPhoto, type TemplateElement } from "@/store/booth-store";
import { loadGoogleFont } from "@/lib/fonts";
import { SHARE_SHORT_URL } from "@/lib/share-upload";
import { GRID_LAYOUTS } from "@/lib/grid-layouts";
import { getBorderById } from "@/lib/borders";
import QRCodeLib from "qrcode";
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";

// ── Constants ──────────────────────────────────────────────
const STAGE_W = 280;
const PRINT_W = 576;
const PIXEL_RATIO = PRINT_W / STAGE_W;
const BLEED = 60;
const DEFAULT_RECEIPT_H = 400;
// Horizontal margin so photos are not edge-to-edge and borders have room
const PHOTO_MARGIN = 8;
// Shorthand for the printable content origin (matches BLEED)
const OX = BLEED;
const OY = BLEED;
// Fixed printer buffer zone at top — the physical printer eats ~15px worth of content
const PRINTER_BUFFER_TOP = 15;

// ── Thermal print simulation filters ──────────────────────
/**
 * Converts ImageData to luminance grayscale in-place.
 * Uses perceptual weights (BT.709) matching what thermal printers use.
 */
function applyGrayscale(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    data[i] = data[i + 1] = data[i + 2] = l;
  }
}

/**
 * Applies contrast + brightness adjustments to grayscale data.
 * contrast: multiplier > 1 increases contrast (applied around midpoint 128)
 * brightness: additive offset in [0-255] range
 */
function applyContrastBrightness(data: Uint8ClampedArray, contrast: number, brightness: number) {
  for (let i = 0; i < data.length; i += 4) {
    let v = data[i];
    v = (v - 128) * contrast + 128 + brightness;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Applies sepia toning (warm-brown shift) then converts to grayscale.
 * This simulates how warm-toned photos print with slightly more contrast in shadow areas.
 */
function applySepiaGray(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const sr = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    const sg = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    const sb = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    // Convert sepia to grayscale — warm tones boost contrast in mid-tones
    const l = sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
    data[i] = data[i + 1] = data[i + 2] = l;
  }
}

// 8×8 Bayer ordered dithering matrix (values 0-63, normalised to 0-255 range)
const BAYER_8: number[] = [
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v / 63) * 255);

/**
 * Floyd-Steinberg error-diffusion dithering.
 * Produces smooth gradients and natural-looking results — good for portraits and photos.
 */
function ditheringFloydSteinberg(imageData: ImageData) {
  applyGrayscale(imageData.data);
  const { data, width, height } = imageData;
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = old - nw;
      buf[idx] = nw;
      if (x + 1 < width) buf[idx + 1] += err * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) buf[idx + width - 1] += err * 3 / 16;
        buf[idx + width] += err * 5 / 16;
        if (x + 1 < width) buf[idx + width + 1] += err * 1 / 16;
      }
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

/**
 * Atkinson dithering — Apple Macintosh classic look.
 * Distributes only 3/4 of error, preserving bright highlights and creating a film-grain aesthetic.
 */
function ditheringAtkinson(imageData: ImageData) {
  applyGrayscale(imageData.data);
  const { data, width, height } = imageData;
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = Math.round((old - nw) / 8); // only 6/8 = 75% of error distributed
      buf[idx] = nw;
      if (x + 1 < width) buf[idx + 1] += err;
      if (x + 2 < width) buf[idx + 2] += err;
      if (y + 1 < height) {
        if (x > 0) buf[idx + width - 1] += err;
        buf[idx + width] += err;
        if (x + 1 < width) buf[idx + width + 1] += err;
      }
      if (y + 2 < height) buf[idx + width * 2] += err;
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

/**
 * Stucki error-diffusion dithering.
 * Wider kernel than Floyd-Steinberg — produces softer, higher-quality results ideal for portraits.
 */
function ditheringStucki(imageData: ImageData) {
  applyGrayscale(imageData.data);
  const { data, width, height } = imageData;
  const buf = new Float32Array(width * height);
  for (let i = 0; i < buf.length; i++) buf[i] = data[i * 4];

  const add = (idx: number, err: number) => {
    if (idx >= 0 && idx < buf.length) buf[idx] += err;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = buf[idx];
      const nw = old < 128 ? 0 : 255;
      const err = old - nw;
      buf[idx] = nw;
      const e = err / 42;
      // Row 0 (current row, right)
      add(idx + 1, e * 8);
      add(idx + 2, e * 4);
      // Row +1
      if (y + 1 < height) {
        add(idx + width - 2, e * 2);
        add(idx + width - 1, e * 4);
        add(idx + width,     e * 8);
        add(idx + width + 1, e * 4);
        add(idx + width + 2, e * 2);
      }
      // Row +2
      if (y + 2 < height) {
        add(idx + width * 2 - 2, e * 1);
        add(idx + width * 2 - 1, e * 2);
        add(idx + width * 2,     e * 4);
        add(idx + width * 2 + 1, e * 2);
        add(idx + width * 2 + 2, e * 1);
      }
    }
  }
  for (let i = 0; i < buf.length; i++) {
    const v = Math.max(0, Math.min(255, buf[i]));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
  }
}

/**
 * Bayer 8×8 ordered dithering (halftone/crosshatch/newspaper look).
 * Each pixel is compared against a threshold from a repeating 8×8 matrix.
 * Produces a bold, graphic, high-contrast crosshatch pattern.
 */
function ditheringBayer8(imageData: ImageData) {
  applyGrayscale(imageData.data);
  const { data, width } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor(i / 4 / width);
    const threshold = BAYER_8[(py % 8) * 8 + (px % 8)];
    const v = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

/**
 * Build the Konva filter pipeline for a given photo filter + dithering algorithm + brightness preset.
 *
 * The pipeline runs in this order:
 *   1. Optional colour cast (sepia/vintage) — shifts hue before grayscale
 *   2. Brightness/contrast adjustment — boosts/reduces tones per the brightness preset
 *   3. Dithering algorithm — simulates how the thermal printer quantises to B&W
 *
 * All algorithms include grayscale conversion internally, so we don't need a separate step.
 *
 * @param filterName  Photo filter preset: "none" | "sepia" | "grayscale" | "vintage" | "contrast"
 * @param algorithm   Dithering algorithm: "atkinson" | "floyd_steinberg" | "stucki" | "bayer8"
 * @param brightness  Brightness preset: "low" | "medium" | "high"
 */
function buildThermalFilters(
  filterName: string,
  algorithm: string,
  brightness: string,
): ((imageData: ImageData) => void)[] {
  // Step 1 — colour cast: convert to grayscale with colour weighting
  const colourStep = (imageData: ImageData) => {
    if (filterName === "sepia" || filterName === "vintage") {
      applySepiaGray(imageData.data);
    } else {
      applyGrayscale(imageData.data);
    }
  };

  // Step 2 — contrast/brightness: applied before dithering for visible effect
  // These values simulate the three printBrightness presets clearly
  const contrastMap: Record<string, number> = { low: 0.75, medium: 1.1, high: 1.5 };
  const brightnessMap: Record<string, number> = { low: -20, medium: 8, high: 25 };
  // "vintage" and "contrast" filters always boost contrast extra
  const filterContrastBoost = filterName === "vintage" ? 0.25 : filterName === "contrast" ? 0.4 : 0;

  const toneStep = (imageData: ImageData) => {
    const c = (contrastMap[brightness] ?? 1.1) + filterContrastBoost;
    const b = brightnessMap[brightness] ?? 8;
    applyContrastBrightness(imageData.data, c, b);
  };

  // Step 3 — dithering algorithm
  const ditherStep = (() => {
    switch (algorithm) {
      case "atkinson":       return ditheringAtkinson;
      case "floyd_steinberg": return ditheringFloydSteinberg;
      case "stucki":         return ditheringStucki;
      case "bayer8":         return ditheringBayer8;
      default:               return ditheringFloydSteinberg;
    }
  })();

  return [colourStep, toneStep, ditherStep];
}

// ── Hooks ──────────────────────────────────────────────────
function useImage(src: string | null): HTMLImageElement | null {
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

/** Generate QR as data URL using the `qrcode` npm package (canvas-based, reliable). */
function useQRDataUrl(url: string, size: number, enabled: boolean): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url || !enabled) { setDataUrl(null); return; }
    const canvas = document.createElement("canvas");
    QRCodeLib.toCanvas(canvas, url, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }, (err) => {
      if (!err) {
        setDataUrl(canvas.toDataURL("image/png"));
      }
    });
  }, [url, size, enabled]);
  return dataUrl;
}

// ── PhotoImageNode: handles filter caching properly ────────
/**
 * Konva requires calling node.cache() for filters to work.  We apply filters
 * IMPERATIVELY inside a useEffect instead of via the `filters` JSX prop so that
 * React-Konva never calls `node.filters(...)` during reconciliation — which would
 * reset Konva's internal `_filterUpToDate` flag and cause dithering to re-run on
 * every unrelated re-render (e.g. when dragging the QR-size slider).
 */
/**
 * Renders a photo with thermal print filters applied imperatively.
 *
 * Key design: filters are applied via useEffect keyed ONLY on [image, filters,
 * contrast, brightness]. Position/size changes (x, y, width, height) do NOT
 * re-trigger the expensive filter pipeline. After any stage.toDataURL() export,
 * the parent must call `node.clearCache(); node.cache()` on every ".photoNode"
 * to restore the screen-resolution cache.
 */
const PhotoImageNode = React.memo(
  function PhotoImageNode({
    id,
    image,
    x,
    y,
    width,
    height,
    rotation,
    filters,
    contrast,
    brightness,
    onSelect,
    onDragStartTracked,
    onDragEndTracked,
    draggable = true,
  }: {
    id: string;
    image: HTMLImageElement;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    filters: ((imageData: ImageData) => void)[];
    contrast: number;
    brightness: number;
    onSelect: (id: string) => void;
    onDragStartTracked?: (id: string) => void;
    onDragEndTracked?: () => void;
    draggable?: boolean;
  }) {
    const nodeRef = useRef<Konva.Image>(null);
    const filtersApplied = useRef(false);

    useEffect(() => {
      const node = nodeRef.current;
      if (!node) return;
      node.filters(filters.length ? filters : []);
      node.contrast(contrast);
      node.brightness(brightness);
      node.clearCache();
      node.cache();
      node.getLayer()?.batchDraw();
      filtersApplied.current = true;
    }, [image, filters, contrast, brightness]);

    // Re-cache only when the node is resized (width/height change from transformer).
    // Position changes (x/y from dragging) do NOT need a re-cache — Konva's cached
    // bitmap stays valid regardless of where the node is drawn on the stage.
    useEffect(() => {
      if (!filtersApplied.current) return;
      const node = nodeRef.current;
      if (!node) return;
      requestAnimationFrame(() => {
        if (!node.parent) return;
        node.clearCache();
        node.cache();
        node.getLayer()?.batchDraw();
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]);

    return (
      <KImage
        ref={nodeRef}
        id={id}
        name="element photoNode"
        image={image}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        draggable={draggable}
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragStart={() => (onDragStartTracked ?? onSelect)(id)}
        onDragEnd={onDragEndTracked}
      />
    );
  },
  (prev, next) => {
    return (
      prev.id === next.id &&
      prev.image === next.image &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height &&
      prev.rotation === next.rotation &&
      prev.filters === next.filters &&
      prev.contrast === next.contrast &&
      prev.brightness === next.brightness &&
      prev.onSelect === next.onSelect &&
      prev.onDragStartTracked === next.onDragStartTracked &&
      prev.onDragEndTracked === next.onDragEndTracked &&
      prev.draggable === next.draggable
    );
  }
);

// ── Sticker sub-component (hooks must be at top level) ────
// Resolution-locked: the KImage always keeps the original image width/height so
// scaling up never degrades quality. Display size is controlled via scaleX/scaleY.
function StickerNode({
  sticker,
  originX,
  originY,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDragStartTracked,
  onDragEndTracked,
}: {
  sticker: { id: string; src: string; x: number; y: number; width: number; height: number; rotation?: number };
  originX: number;
  originY: number;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, w: number, h: number, rotation: number) => void;
  onDragStartTracked?: (id: string) => void;
  onDragEndTracked?: () => void;
}) {
  const img = useImage(sticker.src);
  const nodeRef = useRef<Konva.Image>(null);
  const filtersApplied = useRef(false);

  // Derive scale from desired display size vs original image dimensions.
  const origW = img?.naturalWidth || img?.width || sticker.width;
  const origH = img?.naturalHeight || img?.height || sticker.height;
  const sx = sticker.width / origW;
  const sy = sticker.height / origH;

  // Apply grayscale filter so stickers match the thermal B&W preview
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !img) return;
    node.filters([Konva.Filters.Grayscale]);
    node.clearCache();
    node.cache();
    node.getLayer()?.batchDraw();
    filtersApplied.current = true;
  }, [img]);

  if (!img) return null;

  return (
    <KImage
      ref={nodeRef}
      id={`sticker-${sticker.id}`}
      name="element stickerNode"
      image={img}
      x={sticker.x + originX}
      y={sticker.y + originY}
      width={origW}
      height={origH}
      scaleX={sx}
      scaleY={sy}
      rotation={sticker.rotation || 0}
      draggable
      onClick={() => onSelect(`sticker-${sticker.id}`)}
      onTap={() => onSelect(`sticker-${sticker.id}`)}
      onDragStart={() => (onDragStartTracked ?? onSelect)(`sticker-${sticker.id}`)}
      onDragEnd={(e) => { onDragEnd(sticker.id, e.target.x() - originX, e.target.y() - originY); onDragEndTracked?.(); }}
      onTransformEnd={(e) => {
        const node = e.target;
        // Use uniform scale to guarantee aspect ratio is preserved
        const uniformScale = Math.max(node.scaleX(), node.scaleY());
        const newW = Math.max(10, origW * uniformScale);
        const newH = Math.max(10, origH * uniformScale);
        onTransformEnd(sticker.id, node.x() - originX, node.y() - originY, newW, newH, node.rotation());
      }}
    />
  );
}

// ── Hook to load multiple images at once (for grid photos) ──
function useImages(sources: (string | null)[]): (HTMLImageElement | null)[] {
  const [images, setImages] = useState<(HTMLImageElement | null)[]>([]);
  const keyRef = useRef("");

  useEffect(() => {
    const key = sources.filter(Boolean).join("|");
    if (key === keyRef.current) return;
    keyRef.current = key;

    const loaded: (HTMLImageElement | null)[] = new Array(sources.length).fill(null);
    let cancelled = false;

    sources.forEach((src, i) => {
      if (!src) return;
      const el = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload = () => {
        if (cancelled) return;
        loaded[i] = el;
        setImages([...loaded]);
      };
      el.onerror = () => {
        if (cancelled) return;
        loaded[i] = null;
        setImages([...loaded]);
      };
      el.src = src;
    });

    if (sources.length === 0) setImages([]);
    return () => { cancelled = true; };
  }, [sources.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return images;
}

// Stable no-op for non-interactive PhotoImageNode inside templates
const NOOP_SELECT = (_: string) => {};

// ── Template element renderer (for template mode in dashboard) ─────
function TemplateElementNode({ el, photoSrc, filters, contrast, brightness, photoBorderId, photoRotation }: {
  el: TemplateElement;
  photoSrc?: string;
  filters?: ((imageData: ImageData) => void)[];
  contrast?: number;
  brightness?: number;
  photoBorderId?: string;
  photoRotation?: number;
}) {
  const img = useImage(
    el.type === "image" || el.type === "sticker" || el.type === "logo" ? (el.src ?? null) : null
  );
  const placeholderImg = useImage(el.type === "placeholder" ? (photoSrc ?? null) : null);
  const qrDataUrl = useQRDataUrl(el.type === "qr" ? (el.qrUrl ?? "") : "", el.width, el.type === "qr");
  const qrImg = useImage(qrDataUrl);

  if (el.type === "text") {
    return (
      <KText
        x={el.x} y={el.y} width={el.width}
        text={el.text || ""} fontSize={el.fontSize || 14}
        fontFamily={el.fontFamily || "Inter"} fontStyle={el.fontStyle || "normal"}
        fill={el.fill || "#000000"} align={el.align || "left"}
        rotation={el.rotation} opacity={el.opacity ?? 1}
        listening={false}
      />
    );
  }

  if (el.type === "image" || el.type === "sticker" || el.type === "logo") {
    if (!img) return null;
    return (
      <KImage
        image={img} x={el.x} y={el.y} width={el.width} height={el.height}
        rotation={el.rotation} opacity={el.opacity ?? 1} listening={false}
      />
    );
  }

  if (el.type === "placeholder") {
    if (placeholderImg) {
      const border = photoBorderId ? getBorderById(photoBorderId) : null;
      const isPolaroid = border?.id === "polaroid";
      const hasBorder = border && border.stroke && border.strokeWidth;
      const pad = border?.padding ?? 0;

      const imgAspect = placeholderImg.width / placeholderImg.height;
      const boxAspect = el.width / el.height;
      let drawW = el.width, drawH = el.height, drawX = el.x, drawY = el.y;

      if (isPolaroid) {
        const padTop = pad;
        const padBottom = pad * 2.5;
        const innerW = el.width - pad * 2;
        const innerH = el.height - padTop - padBottom;
        const innerAspect = innerW / innerH;
        if (imgAspect > innerAspect) {
          drawW = innerW; drawH = innerW / imgAspect;
          drawX = el.x + pad; drawY = el.y + padTop + (innerH - drawH) / 2;
        } else {
          drawH = innerH; drawW = innerH * imgAspect;
          drawX = el.x + pad + (innerW - drawW) / 2; drawY = el.y + padTop;
        }
      } else if (imgAspect > boxAspect) {
        drawH = el.width / imgAspect;
        drawY = el.y + (el.height - drawH) / 2;
      } else {
        drawW = el.height * imgAspect;
        drawX = el.x + (el.width - drawW) / 2;
      }

      const appliedRotation = (el.rotation || 0) + (photoRotation || 0);

      return (
        <Group>
          <Rect x={el.x} y={el.y} width={el.width} height={el.height}
            fill={isPolaroid ? "#ffffff" : "#000"} listening={false}
          />
          {isPolaroid && (
            <Rect x={el.x} y={el.y} width={el.width} height={el.height}
              stroke={border!.stroke ?? "#000"} strokeWidth={border!.strokeWidth}
              cornerRadius={border!.cornerRadius ?? 0} listening={false}
            />
          )}
          {hasBorder && !isPolaroid && (
            <Rect x={el.x} y={el.y} width={el.width} height={el.height}
              stroke={border!.stroke!} strokeWidth={border!.strokeWidth}
              cornerRadius={border!.cornerRadius ?? 0} dash={border!.dash}
              listening={false}
            />
          )}
          <PhotoImageNode
            id={`tpl-ph-${el.id}`}
            image={placeholderImg}
            x={drawX} y={drawY} width={drawW} height={drawH}
            rotation={appliedRotation}
            filters={filters ?? []}
            contrast={contrast ?? 0}
            brightness={brightness ?? 0}
            onSelect={NOOP_SELECT}
            draggable={false}
          />
        </Group>
      );
    }
    return (
      <Group>
        <Rect x={el.x} y={el.y} width={el.width} height={el.height}
          fill="#f5f5f5" stroke="#bbb" strokeWidth={1.5} dash={[5, 4]} cornerRadius={3} listening={false}
        />
        <KText
          x={el.x} y={el.y + el.height / 2 - 6} width={el.width}
          text={el.label || "Drop photo"} fontSize={10} fontFamily="monospace"
          align="center" fill="#999" listening={false}
        />
      </Group>
    );
  }

  if (el.type === "shape") {
    return (
      <Rect
        x={el.x} y={el.y} width={el.width} height={el.height}
        fill={el.shapeFill || "transparent"} stroke={el.stroke || "#000"}
        strokeWidth={el.strokeWidth || 2} cornerRadius={el.cornerRadius || 0}
        rotation={el.rotation} opacity={el.opacity ?? 1} listening={false}
      />
    );
  }

  if (el.type === "qr" && qrImg) {
    return (
      <KImage
        image={qrImg} x={el.x} y={el.y} width={el.width} height={el.height}
        rotation={el.rotation} opacity={el.opacity ?? 1} listening={false}
      />
    );
  }

  return null;
}

// ── Export handle ──────────────────────────────────────────
export interface ReceiptCanvasHandle {
  exportImage: () => Promise<Blob | null>;
  exportThumbnail: (maxWidth?: number) => Promise<Blob | null>;
}

// ── Main Component ────────────────────────────────────────
export const ReceiptCanvas = forwardRef<ReceiptCanvasHandle>(function ReceiptCanvas(_, ref) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const clipGroupRef = useRef<Konva.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const themeColors = {
    bleed: isDark ? "#2a261f" : "#f0ece5",
    border: isDark ? "#3d372e" : "#d0d0d0",
    toolbar: isDark ? "#2a261f" : "#ffffff",
    toolbarBorder: isDark ? "#3d372e" : "#d0d0d0",
    toolbarShadow: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.1)",
    labelMuted: isDark ? "#6b6052" : "#999",
    divider: isDark ? "#3d372e" : "#d0d0d0",
  };

  // Template mode
  const activeTemplate = useBoothStore((s) => s.activeTemplate);

  // Granular selectors — only re-render when specific slice changes
  const selectedNodeId = useBoothStore((s) => s.selectedNodeId);
  const qrEnabled = useBoothStore((s) => s.qrEnabled);
  const logoPreview = useBoothStore((s) => s.logoPreview);
  const photoPreview = useBoothStore((s) => s.photoPreview);
  const qrUrl = useBoothStore((s) => s.qrUrl);
  const qrDestination = useBoothStore((s) => s.qrDestination);
  const qrSize = useBoothStore((s) => s.qrSize);
  const qrCaption = useBoothStore((s) => s.qrCaption);
  const showQrCaption = useBoothStore((s) => s.showQrCaption);
  const cafeSlug = useBoothStore((s) => s.cafeSlug);
  const effectiveQrUrl =
    qrDestination === "archivio-share" && SHARE_SHORT_URL
      ? qrUrl.startsWith(SHARE_SHORT_URL)
        ? qrUrl
        : `${SHARE_SHORT_URL}/${cafeSlug || "cafe"}/s/...`
      : qrUrl;
  const memoFont = useBoothStore((s) => s.memoFont);
  const memoFontSize = useBoothStore((s) => s.memoFontSize);
  const memoBold = useBoothStore((s) => s.memoBold);
  const memoItalic = useBoothStore((s) => s.memoItalic);
  const memoUnderline = useBoothStore((s) => s.memoUnderline);
  const memo = useBoothStore((s) => s.memo);
  const headerHeight = useBoothStore((s) => s.headerHeight);
  const headerTextEnabled = useBoothStore((s) => s.headerTextEnabled);
  const headerText = useBoothStore((s) => s.headerText);
  const headerTextSize = useBoothStore((s) => s.headerTextSize);
  const headerTextFont = useBoothStore((s) => s.headerTextFont);
  const headerTextBold = useBoothStore((s) => s.headerTextBold);
  const headerTextItalic = useBoothStore((s) => s.headerTextItalic);
  const headerTextUnderline = useBoothStore((s) => s.headerTextUnderline);
  const eventModeEnabled = useBoothStore((s) => s.eventModeEnabled);
  const eventName = useBoothStore((s) => s.eventName);
  const eventDate = useBoothStore((s) => s.eventDate);
  const eventLocation = useBoothStore((s) => s.eventLocation);
  const photoFilter = useBoothStore((s) => s.photoFilter);
  const photoBorderId = useBoothStore((s) => s.photoBorderId);
  const photoRotation = useBoothStore((s) => s.photoRotation);
  const algorithm = useBoothStore((s) => s.algorithm);
  const printBrightness = useBoothStore((s) => s.printBrightness);
  const stampEnabled = useBoothStore((s) => s.stampEnabled);
  const stampText = useBoothStore((s) => s.stampText);
  const sectionOrder = useBoothStore((s) => s.sectionOrder);
  const stickers = useBoothStore((s) => s.stickers);
  const gridPhotos = useBoothStore((s) => s.gridPhotos);
  const gridLayout = useBoothStore((s) => s.gridLayout);
  const gridCanvasMode = useBoothStore((s) => s.gridCanvasMode);
  const photoMode = useBoothStore((s) => s.photoMode);
  const multiCaptureLayout = useBoothStore((s) => s.multiCaptureLayout);
  const receiptHeightOverride = useBoothStore((s) => s.receiptHeightOverride);

  const [receiptH, setReceiptH] = useState(DEFAULT_RECEIPT_H);

  // Template mode background
  const templateBgImg = useImage(activeTemplate?.backgroundSrc ?? null);

  // Load images
  const logoImg = useImage(logoPreview);
  const photoImg = useImage(photoPreview);

  // QR (canvas-based, black on white)
  const qrDataUrl = useQRDataUrl(effectiveQrUrl, qrSize * 2, qrEnabled);
  const qrImg = useImage(qrDataUrl);

  // Load Google Fonts
  useEffect(() => {
    if (memoFont && memoFont !== "Inter") loadGoogleFont(memoFont);
  }, [memoFont]);
  useEffect(() => {
    if (headerTextFont && headerTextFont !== "Inter") loadGoogleFont(headerTextFont);
  }, [headerTextFont]);

  // Load all grid images at once for accurate height calculation
  const gridSources = gridPhotos.map((p) => p.preview);
  const gridImages = useImages(gridSources);

  // Compute photo display dimensions from actual image (single mode)
  // Use STAGE_W - PHOTO_MARGIN*2 as effective width so the height accounts for margins
  const photoDisplayH = (() => {
    if (!photoImg) return 0;
    const availW = STAGE_W - PHOTO_MARGIN * 2;
    const aspect = photoImg.height / photoImg.width;
    const border = getBorderById(photoBorderId);
    if (border.id === "polaroid") {
      const pad = border.padding ?? 8;
      const imgW = availW - pad * 2;
      return imgW * aspect + pad * 3; // pad top + pad*2 bottom
    }
    return availW * aspect;
  })();

  // Determine if we're using vertical stack layout
  const isVerticalStack = gridLayout.includes("stack") || gridLayout.includes("strip")
    || multiCaptureLayout === "single" || gridPhotos.length > 6;

  // Compute grid photo section height from ACTUAL loaded image dimensions
  const GAP = 4;
  const gridPhotoSectionH = (() => {
    if (photoMode !== "grid" || gridPhotos.length === 0) return 0;

    if (isVerticalStack) {
      // Stack vertically: each photo drawn at STAGE_W - margins, height from actual aspect ratio
      const stackW = STAGE_W - PHOTO_MARGIN * 2;
      let totalH = 0;
      for (let i = 0; i < gridPhotos.length; i++) {
        const img = gridImages[i];
        if (img) {
          totalH += stackW * (img.height / img.width);
        } else {
          totalH += stackW * 0.75; // estimate 4:3 while loading
        }
        if (i < gridPhotos.length - 1) totalH += GAP;
      }
      return totalH;
    }

    // For grid/cell layouts, use a square-ish area
    return STAGE_W * 1.0;
  })();

  // Compute receipt height dynamically from content (or use template height)
  useEffect(() => {
    if (activeTemplate) {
      setReceiptH(activeTemplate.canvasH);
      return;
    }
    let h = PRINTER_BUFFER_TOP + 10;
    for (const section of sectionOrder) {
      switch (section) {
        case "logo": {
          const hasHeader = (headerTextEnabled && headerText) || (eventModeEnabled && eventName);
          if (logoPreview) h += headerHeight * (STAGE_W / PRINT_W) + 10;
          if (hasHeader) h += headerTextSize + 10;
          if (logoPreview || hasHeader) h += 15;
          break;
        }
        case "photo":
          if (photoMode === "single") {
            if (photoImg) h += photoDisplayH + 10;
          } else {
            if (gridPhotos.length > 0) h += gridPhotoSectionH + 10;
          }
          break;
        case "memo":
          if (memo) h += Math.max(40, memo.split("\n").length * (memoFontSize + 4) + 20);
          break;
        case "qr":
          if (qrEnabled && effectiveQrUrl) h += qrSize + 30;
          break;
        case "stamp": {
          const hasStamp = stampEnabled || (eventModeEnabled && (eventDate || eventLocation));
          if (hasStamp) h += 25;
          break;
        }
      }
    }
    h += 30;
    const autoH = Math.max(200, h);
    setReceiptH(receiptHeightOverride > 0 ? Math.max(autoH, receiptHeightOverride) : autoH);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTemplate,
    sectionOrder, logoPreview, headerHeight, headerTextEnabled,
    headerText, headerTextSize, eventModeEnabled, eventName, eventDate, eventLocation,
    photoImg, photoDisplayH, memo, memoFontSize, effectiveQrUrl, qrSize, stampEnabled, qrEnabled,
    photoMode, gridPhotos.length, gridPhotoSectionH, gridImages,
    receiptHeightOverride,
  ]);

  useEffect(() => {
    useBoothStore.getState().setReceiptStageSize(STAGE_W, receiptH);
  }, [receiptH]);

  // Build the thermal preview filter pipeline for the current settings.
  // This is a single array of pixel-manipulation functions that simulates the full
  // thermal print pipeline: colour cast → brightness/contrast → dithering algorithm.
  // useMemo so the array reference only changes when settings actually change,
  // which prevents PhotoImageNode from needlessly re-caching.
  const thermalFilters = React.useMemo(
    () => buildThermalFilters(photoFilter, algorithm, printBrightness),
    [photoFilter, algorithm, printBrightness],
  );
  // Konva numeric contrast/brightness are no longer used for the main simulation
  // (the custom filters handle everything), but PhotoImageNode still requires them
  // — pass 0/0 so they don't interfere with our pixel-level pipeline.
  const thermalContrast = 0;
  const thermalBrightness = 0;

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (selectedNodeId) {
      const node = stage.findOne(`#${selectedNodeId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedNodeId]);

  // Force clip group redraw when interaction state changes so elements
  // outside the printable area appear/disappear correctly
  useEffect(() => {
    clipGroupRef.current?.getLayer()?.batchDraw();
  }, [selectedNodeId, isDragging]);

  // Export the printable area as a blob.
  // After high-DPI export, Konva's internal filter caches are at the export
  // resolution. We must re-cache every filtered node at screen resolution so
  // the live preview doesn't appear corrupted.
  const exportImage = useCallback(async (): Promise<Blob | null> => {
    const stage = stageRef.current;
    if (!stage) return null;
    useBoothStore.getState().setSelectedNodeId(null);
    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer()?.batchDraw();

    // Ensure clip group contracts to printable area (selectedNodeId=null)
    clipGroupRef.current?.getLayer()?.batchDraw();
    await new Promise((r) => setTimeout(r, 200));

    const dataUrl = stage.toDataURL({
      x: OX,
      y: OY,
      width: STAGE_W,
      height: receiptH,
      pixelRatio: PIXEL_RATIO,
      mimeType: "image/png",
    });

    // Re-cache all filtered nodes at screen resolution to restore live preview
    const photoNodes = stage.find(".photoNode") as Konva.Image[];
    for (const node of photoNodes) {
      node.clearCache();
      node.cache();
    }
    const stickerNodes = stage.find(".stickerNode") as Konva.Image[];
    for (const node of stickerNodes) {
      node.clearCache();
      node.cache();
    }
    (stage.findOne("Layer") as Konva.Layer | undefined)?.batchDraw();

    const res = await fetch(dataUrl);
    return res.blob();
  }, [receiptH]);

  const exportThumbnail = useCallback(async (maxWidth = 200): Promise<Blob | null> => {
    const stage = stageRef.current;
    if (!stage) return null;
    useBoothStore.getState().setSelectedNodeId(null);
    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer()?.batchDraw();
    clipGroupRef.current?.getLayer()?.batchDraw();
    await new Promise((r) => setTimeout(r, 150));

    const ratio = maxWidth / STAGE_W;
    const dataUrl = stage.toDataURL({
      x: OX,
      y: OY,
      width: STAGE_W,
      height: receiptH,
      pixelRatio: ratio,
      mimeType: "image/png",
    });

    const photoNodes = stage.find(".photoNode") as Konva.Image[];
    for (const node of photoNodes) { node.clearCache(); node.cache(); }
    const stickerNodes = stage.find(".stickerNode") as Konva.Image[];
    for (const node of stickerNodes) { node.clearCache(); node.cache(); }
    (stage.findOne("Layer") as Konva.Layer | undefined)?.batchDraw();

    const res = await fetch(dataUrl);
    return res.blob();
  }, [receiptH]);

  useImperativeHandle(ref, () => ({ exportImage, exportThumbnail }), [exportImage, exportThumbnail]);

  // Click on empty = deselect
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "background" || e.target.name() === "bleed") {
      useBoothStore.getState().setSelectedNodeId(null);
    }
  };

  // Double-click text to edit
  const handleTextDblClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, setter: (v: string) => void, currentValue: string) => {
    const textNode = e.target as Konva.Text;
    const stage = stageRef.current;
    if (!stage) return;

    textNode.hide();
    const layer = textNode.getLayer();
    layer?.batchDraw();

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    const areaPosition = { x: stageBox.left + textPosition.x, y: stageBox.top + textPosition.y };

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.value = currentValue;
    textarea.style.position = "fixed";
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${textNode.width() * textNode.scaleX()}px`;
    textarea.style.height = `${textNode.height() * textNode.scaleY() + 10}px`;
    textarea.style.fontSize = `${textNode.fontSize()}px`;
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.border = "2px solid #3b82f6";
    textarea.style.borderRadius = "4px";
    textarea.style.padding = "2px 4px";
    textarea.style.outline = "none";
    textarea.style.background = "white";
    textarea.style.color = "black";
    textarea.style.zIndex = "10000";
    textarea.style.resize = "none";
    textarea.focus();

    const finish = () => {
      setter(textarea.value);
      textarea.remove();
      textNode.show();
      layer?.batchDraw();
    };
    textarea.addEventListener("blur", finish);
    textarea.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { textarea.value = currentValue; finish(); }
      if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); finish(); }
    });
  };

  // Layer ordering
  const moveLayer = useCallback((dir: "up" | "down" | "top" | "bottom") => {
    const stage = stageRef.current;
    if (!stage || !selectedNodeId) return;
    const node = stage.findOne(`#${selectedNodeId}`);
    if (!node) return;
    if (dir === "up") node.moveUp();
    else if (dir === "down") node.moveDown();
    else if (dir === "top") node.moveToTop();
    else if (dir === "bottom") node.moveToBottom();
    node.getLayer()?.batchDraw();
  }, [selectedNodeId]);

  // Delete selected element
  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const s = useBoothStore.getState();
    if (selectedNodeId === "logo-img") s.clearLogo();
    else if (selectedNodeId === "header-text") s.setHeaderText("");
    else if (selectedNodeId === "photo-img") s.clearPhoto();
    else if (selectedNodeId === "memo-text") s.setMemo("");
    else if (selectedNodeId === "qr-img") s.setQrEnabled(false);
    else if (selectedNodeId === "qr-caption") s.setQrCaption("");
    else if (selectedNodeId === "stamp-text") s.toggleStamp();
    else if (selectedNodeId.startsWith("sticker-")) {
      s.removeSticker(selectedNodeId.replace("sticker-", ""));
    }
    else if (selectedNodeId.startsWith("grid-photo-")) {
      s.removeGridPhoto(selectedNodeId.replace("grid-photo-", ""));
    }
    s.setSelectedNodeId(null);
  }, [selectedNodeId]);

  // Build section Y positions
  const buildSectionLayout = () => {
    const layout: Record<string, { y: number; h: number }> = {};
    let y = PRINTER_BUFFER_TOP + 10;
    for (const section of sectionOrder) {
      let h = 0;
      switch (section) {
        case "logo": {
          const hasHeader = (headerTextEnabled && headerText) || (eventModeEnabled && eventName);
          if (logoPreview || hasHeader) {
            h = (logoPreview ? headerHeight * (STAGE_W / PRINT_W) + 10 : 0) +
              (hasHeader ? headerTextSize + 10 : 0) + 15;
          }
          break;
        }
        case "photo":
          if (photoMode === "single") {
            if (photoImg) h = photoDisplayH + 10;
          } else {
            if (gridPhotos.length > 0) h = gridPhotoSectionH + 10;
          }
          break;
        case "memo":
          if (memo) h = Math.max(40, memo.split("\n").length * (memoFontSize + 4) + 20);
          break;
        case "qr":
          if (qrEnabled && effectiveQrUrl) h = qrSize + 30;
          break;
        case "stamp":
          if (stampEnabled || (eventModeEnabled && (eventDate || eventLocation))) h = 25;
          break;
      }
      layout[section] = { y, h };
      if (h > 0) y += h;
    }
    return layout;
  };

  const sectionLayout = buildSectionLayout();
  const totalW = STAGE_W + BLEED * 2;
  const totalH = receiptH + BLEED * 2;

  const selectNode = useCallback((id: string) => useBoothStore.getState().setSelectedNodeId(id), []);

  const onDragStartTracked = useCallback((id: string) => {
    setIsDragging(true);
    useBoothStore.getState().setSelectedNodeId(id);
  }, []);

  const onDragEndTracked = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Sticker callbacks
  const handleStickerDragEnd = useCallback((id: string, x: number, y: number) => {
    useBoothStore.getState().updateSticker(id, { x, y });
  }, []);

  const handleStickerTransformEnd = useCallback((id: string, x: number, y: number, w: number, h: number, rotation: number) => {
    useBoothStore.getState().updateSticker(id, { x, y, width: w, height: h, rotation });
  }, []);

  // ── Render sections ─────────────────────────────────────

  const renderLogo = () => {
    const hasHeader = (headerTextEnabled && headerText) || (eventModeEnabled && eventName);
    if (!logoImg && !hasHeader) return null;
    const layout = sectionLayout["logo"];
    if (!layout || layout.h === 0) return null;
    const items: React.ReactNode[] = [];

    if (logoImg) {
      const maxW = STAGE_W * 0.5;
      const maxH = headerHeight * (STAGE_W / PRINT_W);
      const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
      const w = logoImg.width * ratio;
      const h = logoImg.height * ratio;
      items.push(
        <KImage
          key="logo-img"
          id="logo-img"
          name="element"
          image={logoImg}
          x={OX + (STAGE_W - w) / 2}
          y={OY + layout.y}
          width={w}
          height={h}
          draggable
          shadowColor="rgba(255,255,255,0.8)"
          shadowBlur={2}
          onClick={() => selectNode("logo-img")}
          onTap={() => selectNode("logo-img")}
          onDragStart={() => onDragStartTracked("logo-img")}
          onDragEnd={onDragEndTracked}
        />
      );
    }

    if (hasHeader) {
      const displayHeaderText = eventModeEnabled && eventName ? eventName : headerText;
      const textY = logoImg ? layout.y + headerHeight * (STAGE_W / PRINT_W) + 12 : layout.y;
      items.push(
        <KText
          key="header-text"
          id="header-text"
          name="element"
          text={displayHeaderText}
          x={OX}
          y={OY + textY}
          width={STAGE_W}
          align="center"
          fontSize={headerTextSize}
          fontFamily={headerTextFont}
          fontStyle={`${headerTextBold ? "bold" : ""} ${headerTextItalic ? "italic" : ""}`.trim() || "normal"}
          textDecoration={headerTextUnderline ? "underline" : ""}
          fill="#000000"
          draggable
          onClick={() => selectNode("header-text")}
          onTap={() => selectNode("header-text")}
          onDragStart={() => onDragStartTracked("header-text")}
          onDragEnd={onDragEndTracked}
          onDblClick={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setHeaderText(v), headerText)}
          onDblTap={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setHeaderText(v), headerText)}
        />
      );
    }

    return <>{items}</>;
  };

  const renderPhoto = () => {
    const layout = sectionLayout["photo"];
    if (!layout || layout.h === 0) return null;

    const filters = thermalFilters;

    // ── Single photo mode ──
    if (photoMode === "single") {
      if (!photoImg) return null;
      const border = getBorderById(photoBorderId);

      // Inset the image from the printable area edge by PHOTO_MARGIN so borders have room.
      // The border rect surrounds the image exactly — stroke is centered on the rect edge
      // (half outside, half inside). With PHOTO_MARGIN=8 and max strokeWidth=5, the outer
      // edge of the stroke sits 4px inside the printable area boundary, never clipping.
      const availW = STAGE_W - PHOTO_MARGIN * 2;
      const imgAspect = photoImg.width / photoImg.height;
      const py = OY + layout.y + 5;
      const px = OX + PHOTO_MARGIN;

      // Polaroid: image is inset inside a white-padded frame
      if (border.id === "polaroid") {
        const pad = border.padding ?? 8;
        const frameW = availW;
        const imgW = frameW - pad * 2;
        const imgH = imgW / imgAspect;
        const bottomPad = pad * 2;
        const frameH = imgH + pad + bottomPad;
        return (
          <Group>
            <Rect
              x={px}
              y={py}
              width={frameW}
              height={frameH}
              fill="#ffffff"
              stroke={border.stroke ?? "#000000"}
              strokeWidth={border.strokeWidth}
              listening={false}
            />
            <PhotoImageNode
              id="photo-img"
              image={photoImg}
              x={px + pad}
              y={py + pad}
              width={imgW}
              height={imgH}
              rotation={photoRotation}
              filters={filters}
              contrast={thermalContrast}
              brightness={thermalBrightness}
              onSelect={selectNode}
              onDragStartTracked={onDragStartTracked}
              onDragEndTracked={onDragEndTracked}
            />
          </Group>
        );
      }

      const w = availW;
      const h = w / imgAspect;

      const borderRect = border.stroke && border.strokeWidth ? (
        <Rect
          x={px}
          y={py}
          width={w}
          height={h}
          stroke={border.stroke}
          strokeWidth={border.strokeWidth}
          cornerRadius={border.cornerRadius ?? 0}
          dash={border.dash}
          listening={false}
        />
      ) : null;
      return (
        <Group>
          {borderRect}
          <PhotoImageNode
            id="photo-img"
            image={photoImg}
            x={px}
            y={py}
            width={w}
            height={h}
            rotation={photoRotation}
            filters={filters}
            contrast={thermalContrast}
            brightness={thermalBrightness}
            onSelect={selectNode}
            onDragStartTracked={onDragStartTracked}
            onDragEndTracked={onDragEndTracked}
          />
        </Group>
      );
    }

    // ── Grid photo mode ── render directly using loaded gridImages
    if (gridPhotos.length === 0) return null;

    const sectionY = layout.y + 5;
    const sectionH = layout.h - 10;

    // Freestyle mode: use custom positions from each photo
    if (gridCanvasMode) {
      const items: React.ReactNode[] = [];
      for (let i = 0; i < gridPhotos.length; i++) {
        const photo = gridPhotos[i];
        const img = gridImages[i];
        if (!img) continue;

        const x = photo.x ?? 5;
        const y = photo.y ?? 5;
        const w = photo.w ?? 60;
        const h = photo.h ?? 60;

        const drawX = (x / 100) * STAGE_W;
        const drawY = sectionY + (y / 100) * sectionH;
        const drawW = (w / 100) * STAGE_W;
        const drawH = (h / 100) * sectionH;

        items.push(
          <PhotoImageNode
            key={photo.id}
            id={`grid-photo-${photo.id}`}
            image={img}
            x={drawX + OX}
            y={drawY + OY}
            width={drawW}
            height={drawH}
            rotation={photoRotation}
            filters={filters}
            contrast={thermalContrast}
            brightness={thermalBrightness}
            onSelect={selectNode}
            onDragStartTracked={onDragStartTracked}
            onDragEndTracked={onDragEndTracked}
          />
        );
      }
      return <>{items}</>;
    }

    const cells = GRID_LAYOUTS[gridLayout] || GRID_LAYOUTS["1-full"];

    // Vertical stack: each photo drawn at STAGE_W - margins, actual height from aspect ratio
    if (isVerticalStack) {
      const items: React.ReactNode[] = [];
      let curY = sectionY;
      const stackW = STAGE_W - PHOTO_MARGIN * 2;
      for (let i = 0; i < gridPhotos.length; i++) {
        const img = gridImages[i];
        if (!img) continue;
        const drawW = stackW;
        const drawH = stackW * (img.height / img.width);
        const photoId = gridPhotos[i].id;
        items.push(
          <PhotoImageNode
            key={photoId}
            id={`grid-photo-${photoId}`}
            image={img}
            x={OX + PHOTO_MARGIN}
            y={OY + curY}
            width={drawW}
            height={drawH}
            rotation={photoRotation}
            filters={filters}
            contrast={thermalContrast}
            brightness={thermalBrightness}
            onSelect={selectNode}
            onDragStartTracked={onDragStartTracked}
            onDragEndTracked={onDragEndTracked}
          />
        );
        curY += drawH + GAP;
      }
      return <>{items}</>;
    }

    // Layout-based grid: use percentage cells, fit each photo fully (no crop)
    const items: React.ReactNode[] = [];
    const gridAreaW = STAGE_W - PHOTO_MARGIN * 2;
    for (let i = 0; i < Math.min(cells.length, gridPhotos.length); i++) {
      const cell = cells[i];
      const img = gridImages[i];
      if (!img || !cell) continue;

      const cellX = PHOTO_MARGIN + (cell.x / 100) * gridAreaW;
      const cellY = sectionY + (cell.y / 100) * sectionH;
      const cellW = (cell.w / 100) * gridAreaW;
      const cellH = (cell.h / 100) * sectionH;

      const imgAspect = img.width / img.height;
      const cellAspect = cellW / cellH;
      let drawW: number, drawH: number;
      if (imgAspect > cellAspect) {
        drawW = cellW;
        drawH = cellW / imgAspect;
      } else {
        drawH = cellH;
        drawW = cellH * imgAspect;
      }
      const drawX = cellX + (cellW - drawW) / 2;
      const drawY = cellY + (cellH - drawH) / 2;

      const photoId = gridPhotos[i].id;
      items.push(
        <PhotoImageNode
          key={photoId}
          id={`grid-photo-${photoId}`}
          image={img}
          x={OX + drawX}
          y={OY + drawY}
          width={drawW}
          height={drawH}
          rotation={photoRotation}
          filters={filters}
          contrast={thermalContrast}
          brightness={thermalBrightness}
          onSelect={selectNode}
          onDragStartTracked={onDragStartTracked}
          onDragEndTracked={onDragEndTracked}
        />
      );
    }
    return <>{items}</>;
  };

  const renderMemo = () => {
    if (!memo) return null;
    const layout = sectionLayout["memo"];
    if (!layout || layout.h === 0) return null;

    return (
      <KText
        id="memo-text"
        name="element"
        text={memo}
        x={OX + 20}
        y={OY + layout.y + 5}
        width={STAGE_W - 40}
        align="center"
        fontSize={memoFontSize}
        fontFamily={memoFont}
        fontStyle={`${memoBold ? "bold" : ""} ${memoItalic ? "italic" : ""}`.trim() || "normal"}
        textDecoration={memoUnderline ? "underline" : ""}
        fill="#000000"
        draggable
        onClick={() => selectNode("memo-text")}
        onTap={() => selectNode("memo-text")}
        onDragStart={() => onDragStartTracked("memo-text")}
        onDragEnd={onDragEndTracked}
        onDblClick={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setMemo(v), memo)}
        onDblTap={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setMemo(v), memo)}
      />
    );
  };

  const renderQR = () => {
    if (!qrEnabled || !qrImg) return null;
    const layout = sectionLayout["qr"];
    if (!layout || layout.h === 0) return null;

    const size = qrSize;
    return (
      <Group>
        <KImage
          id="qr-img"
          name="element"
          image={qrImg}
          x={OX + (STAGE_W - size) / 2}
          y={OY + layout.y + 5}
          width={size}
          height={size}
          draggable
          onClick={() => selectNode("qr-img")}
          onTap={() => selectNode("qr-img")}
          onDragStart={() => onDragStartTracked("qr-img")}
          onDragEnd={onDragEndTracked}
        />
        {showQrCaption && (
          <KText
            id="qr-caption"
            name="element"
            text={qrCaption || "scan for your digital copy"}
            x={OX}
            y={OY + layout.y + size + 8}
            width={STAGE_W}
            align="center"
            fontSize={9}
            fontFamily="Inter, sans-serif"
            fill="#666666"
            draggable
            onClick={() => selectNode("qr-caption")}
            onTap={() => selectNode("qr-caption")}
            onDragStart={() => onDragStartTracked("qr-caption")}
            onDragEnd={onDragEndTracked}
            onDblClick={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setQrCaption(v), qrCaption || "scan for your digital copy")}
            onDblTap={(e) => handleTextDblClick(e, (v) => useBoothStore.getState().setQrCaption(v), qrCaption || "scan for your digital copy")}
          />
        )}
      </Group>
    );
  };

  const renderStamp = () => {
    const hasStamp = (stampEnabled && stampText) || (eventModeEnabled && (eventDate || eventLocation));
    if (!hasStamp) return null;
    const layout = sectionLayout["stamp"];
    if (!layout || layout.h === 0) return null;
    const displayStampText = eventModeEnabled
      ? [eventDate, eventLocation].filter(Boolean).join(" · ")
      : stampText;

    return (
      <KText
        id="stamp-text"
        name="element"
        text={displayStampText}
        x={OX}
        y={OY + layout.y + 5}
        width={STAGE_W}
        align="center"
        fontSize={9}
        fontFamily="Inter, sans-serif"
        fill="#333333"
        draggable
        dragBoundFunc={(pos) => {
          // Constrain to vertical movement only, keep centered horizontally
          return { x: OX, y: Math.max(OY, Math.min(pos.y, OY + receiptH - 20)) };
        }}
        onClick={() => selectNode("stamp-text")}
        onTap={() => selectNode("stamp-text")}
        onDragStart={() => onDragStartTracked("stamp-text")}
        onDragEnd={onDragEndTracked}
      />
    );
  };

  return (
    <div style={{ width: totalW, height: totalH, position: "relative", overflow: "hidden", borderRadius: 12 }}>
      {/* Layer ordering toolbar */}
      {selectedNodeId && (
        <div
          style={{
            position: "absolute",
            top: BLEED - 30,
            left: BLEED,
            zIndex: 100,
            display: "flex",
            gap: 2,
            background: themeColors.toolbar,
            color: isDark ? "#e8e2d8" : "#2c2418",
            border: `1px solid ${themeColors.toolbarBorder}`,
            borderRadius: 6,
            padding: "2px 4px",
            boxShadow: `0 1px 4px ${themeColors.toolbarShadow}`,
          }}
        >
          <button onClick={() => moveLayer("bottom")} title="Send to back" style={{ padding: "1px 3px", cursor: "pointer", background: "none", border: "none" }}>
            <ChevronsDown size={14} />
          </button>
          <button onClick={() => moveLayer("down")} title="Move backward" style={{ padding: "1px 3px", cursor: "pointer", background: "none", border: "none" }}>
            <ChevronDown size={14} />
          </button>
          <button onClick={() => moveLayer("up")} title="Move forward" style={{ padding: "1px 3px", cursor: "pointer", background: "none", border: "none" }}>
            <ChevronUp size={14} />
          </button>
          <button onClick={() => moveLayer("top")} title="Bring to front" style={{ padding: "1px 3px", cursor: "pointer", background: "none", border: "none" }}>
            <ChevronsUp size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: themeColors.divider, margin: "0 2px" }} />
          <button onClick={deleteSelected} title="Delete element" style={{ padding: "1px 3px", cursor: "pointer", background: "none", border: "none", color: "#ef4444" }}>
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={totalW}
        height={totalH}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ cursor: "default" }}
      >
        <Layer>
          {/* Bleed zone background — fills the entire visible stage */}
          <Rect name="bleed" x={0} y={0} width={totalW} height={totalH} fill={themeColors.bleed} />

          {/* Clipped group: clips to the printable area by default so off-screen
              elements are hidden. Expands to include the bleed zone when an element
              is selected or being dragged (Instagram story-style). */}
          <Group
            ref={clipGroupRef}
            clipFunc={(ctx) => {
              if (selectedNodeId || isDragging) {
                ctx.rect(0, 0, totalW, totalH);
              } else {
                ctx.rect(OX, OY, STAGE_W, receiptH);
              }
            }}
          >
            {/* Printable area */}
            <Rect
              name="background"
              x={BLEED}
              y={BLEED}
              width={STAGE_W}
              height={receiptH}
              fill="#ffffff"
              stroke={themeColors.border}
              strokeWidth={1}
            />

            {/* Printer buffer zone indicator (fixed, not user-configurable) */}
            <Rect
              x={BLEED}
              y={BLEED}
              width={STAGE_W}
              height={PRINTER_BUFFER_TOP}
              fill="rgba(255,180,120,0.75)"
              listening={false}
            />
            <Rect
              x={BLEED}
              y={BLEED + PRINTER_BUFFER_TOP}
              width={STAGE_W}
              height={0}
              stroke="rgba(180,120,60,0.5)"
              strokeWidth={0.5}
              dash={[3, 3]}
              listening={false}
            />
            <KText
              x={BLEED + 4}
              y={BLEED + 1}
              text="printer unprintable area"
              fontSize={7}
              fill="rgba(140,90,40,0.6)"
              fontFamily="monospace"
              listening={false}
            />

            {/* Template mode: render template elements with photos in placeholders */}
            {activeTemplate ? (
              <>
                <Group x={BLEED} y={BLEED}>
                  {templateBgImg && (
                    <KImage image={templateBgImg} x={0} y={0} width={STAGE_W} height={receiptH} listening={false} />
                  )}
                  {activeTemplate.elements.map((el) => (
                    <TemplateElementNode
                      key={el.id}
                      el={el}
                      photoSrc={el.type === "placeholder" ? (photoPreview ?? undefined) : undefined}
                      filters={thermalFilters}
                      contrast={thermalContrast}
                      brightness={thermalBrightness}
                      photoBorderId={photoBorderId}
                      photoRotation={photoRotation}
                    />
                  ))}

                  {/* Stamp overlay in template mode */}
                  {(() => {
                    const hasStamp = (stampEnabled && stampText) || (eventModeEnabled && (eventDate || eventLocation));
                    if (!hasStamp) return null;
                    const displayText = eventModeEnabled
                      ? [eventDate, eventLocation].filter(Boolean).join(" · ")
                      : stampText;
                    return (
                      <KText
                        id="stamp-text"
                        name="element"
                        text={displayText}
                        x={0}
                        y={receiptH - 20}
                        width={STAGE_W}
                        align="center"
                        fontSize={9}
                        fontFamily="Inter, sans-serif"
                        fill="#333333"
                        listening={false}
                      />
                    );
                  })()}
                </Group>

                {/* Stickers on top of template */}
                {stickers.map((sticker) => (
                  <StickerNode
                    key={sticker.id}
                    sticker={sticker}
                    originX={BLEED}
                    originY={BLEED}
                    onSelect={selectNode}
                    onDragEnd={handleStickerDragEnd}
                    onTransformEnd={handleStickerTransformEnd}
                    onDragStartTracked={onDragStartTracked}
                    onDragEndTracked={onDragEndTracked}
                  />
                ))}
              </>
            ) : (
              <>
                {/* Content */}
                {renderLogo()}
                {renderPhoto()}
                {renderMemo()}
                {renderQR()}
                {renderStamp()}

                {/* Stickers */}
                {stickers.map((sticker) => (
                  <StickerNode
                    key={sticker.id}
                    sticker={sticker}
                    originX={BLEED}
                    originY={BLEED}
                    onSelect={selectNode}
                    onDragEnd={handleStickerDragEnd}
                    onTransformEnd={handleStickerTransformEnd}
                    onDragStartTracked={onDragStartTracked}
                    onDragEndTracked={onDragEndTracked}
                  />
                ))}
              </>
            )}

            {/* Printable area border */}
            <Rect
              x={BLEED}
              y={BLEED}
              width={STAGE_W}
              height={receiptH}
              stroke="#3b82f6"
              strokeWidth={0.5}
              dash={[4, 4]}
              listening={false}
            />
          </Group>

          {/* Transformer outside clip group so handles are always visible */}
          {(() => {
            const isStickerSelected = !!selectedNodeId && selectedNodeId.startsWith("sticker-");
            return (
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                keepRatio={isStickerSelected}
                enabledAnchors={isStickerSelected
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
                }
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 10 || newBox.height < 10) return oldBox;
                  return newBox;
                }}
                borderStroke="#3b82f6"
                borderStrokeWidth={2}
                anchorStroke="#3b82f6"
                anchorFill="#ffffff"
                anchorSize={10}
                anchorCornerRadius={2}
              />
            );
          })()}
        </Layer>
      </Stage>

      {/* Labels */}
      <div style={{ position: "absolute", top: 8, left: BLEED + 4, fontSize: 8, color: themeColors.labelMuted, pointerEvents: "none" }}>
        bleed zone
      </div>
      <div style={{ position: "absolute", top: BLEED - 12, right: BLEED, fontSize: 8, color: "#3b82f6", pointerEvents: "none" }}>
        printable area
      </div>
    </div>
  );
});
