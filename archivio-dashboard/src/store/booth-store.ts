import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "@/lib/idb-storage";

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface Sticker {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface GridPhoto {
  id: string;
  preview: string;
  filename: string;
  cropData: CropData | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  uploadStatus?: "uploading" | "uploaded" | "failed" | "local";
}

export interface PrintJob {
  id: string;
  status: "pending" | "printing" | "done" | "error";
  message?: string;
  timestamp: number;
}

export type AspectRatio = "1:1" | "4:3" | "3:4" | "4:5" | "5:4" | "9:16" | "16:9" | "2:3" | "3:2" | "free";

export interface TemplateElement {
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
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fill?: string;
  align?: string;
  src?: string;
  borderStyle?: string;
  shapeType?: "rect" | "circle" | "line";
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  shapeFill?: string;
  qrUrl?: string;
  opacity?: number;
}

export interface ActiveTemplate {
  id: string;
  name: string;
  elements: TemplateElement[];
  canvasH: number;
  backgroundSrc: string | null;
}

export interface BoothStore {
  // Cafe identification
  cafeSlug: string;
  setCafeSlug: (slug: string) => void;

  // Connection
  piConnected: boolean;
  cameraAvailable: boolean;
  printerAvailable: boolean;
  setPiStatus: (connected: boolean, camera: boolean, printer: boolean) => void;

  // Canvas selection (for Konva Transformer)
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Logo
  logoPreview: string | null;
  logoOriginalPreview: string | null;
  logoFilename: string;
  logoCrop: CropData | null;
  headerHeight: number;
  headerTextEnabled: boolean;
  headerText: string;
  headerTextFont: string;
  headerTextSize: number;
  headerTextBold: boolean;
  headerTextItalic: boolean;
  headerTextUnderline: boolean;
  setLogo: (preview: string, filename: string) => void;
  setLogoOriginal: (url: string) => void;
  resetLogoToOriginal: () => void;
  clearLogo: () => void;
  setLogoCrop: (crop: CropData | null) => void;
  setHeaderHeight: (h: number) => void;
  setHeaderTextEnabled: (on: boolean) => void;
  setHeaderText: (text: string) => void;
  setHeaderTextFont: (font: string) => void;
  setHeaderTextSize: (size: number) => void;
  setHeaderTextBold: (on: boolean) => void;
  setHeaderTextItalic: (on: boolean) => void;
  setHeaderTextUnderline: (on: boolean) => void;

  // Photo
  photoMode: "single" | "grid";
  setPhotoMode: (mode: "single" | "grid") => void;
  photoPreview: string | null;
  photoOriginalPreview: string | null;
  photoFilename: string;
  photoCrop: CropData | null;
  photoAspectRatio: AspectRatio;
  photoRotation: number;
  photoFilter: string;
  photoBorderId: string;
  setPhoto: (preview: string, filename: string) => void;
  setPhotoOriginal: (url: string) => void;
  resetPhotoToOriginal: () => void;
  clearPhoto: () => void;
  setPhotoFilter: (filter: string) => void;
  setPhotoBorderId: (id: string) => void;
  setPhotoCrop: (crop: CropData | null) => void;
  setPhotoAspectRatio: (ratio: AspectRatio) => void;
  setPhotoRotation: (deg: number) => void;

  // Grid
  gridPhotos: GridPhoto[];
  gridLayout: string;
  gridCanvasMode: boolean;
  addGridPhoto: (photo: GridPhoto) => void;
  removeGridPhoto: (id: string) => void;
  updateGridPhotoCrop: (id: string, crop: CropData) => void;
  shuffleGridLayout: () => void;
  setGridLayout: (layout: string) => void;
  setGridCanvasMode: (on: boolean) => void;
  updateGridPhotoPos: (id: string, updates: Partial<Pick<GridPhoto, "x" | "y" | "w" | "h">>) => void;
  updateGridPhoto: (id: string, updates: Partial<GridPhoto>) => void;

  // Memo
  memo: string;
  memoFont: string;
  memoFontSize: number;
  memoBold: boolean;
  memoItalic: boolean;
  memoUnderline: boolean;
  savedMemos: string[];
  setMemo: (memo: string) => void;
  setMemoFont: (font: string) => void;
  setMemoFontSize: (size: number) => void;
  setMemoBold: (on: boolean) => void;
  setMemoItalic: (on: boolean) => void;
  setMemoUnderline: (on: boolean) => void;
  addSavedMemo: (text: string) => void;
  removeSavedMemo: (text: string) => void;

  // QR
  qrEnabled: boolean;
  qrUrl: string;
  qrSize: number;
  qrCaption: string;
  showQrCaption: boolean;
  /** "archivio-share" = QR links to share app (set at print time); "custom" = use qrUrl as-is */
  qrDestination: "custom" | "archivio-share";
  setQrEnabled: (on: boolean) => void;
  setQrUrl: (url: string) => void;
  setQrSize: (size: number) => void;
  setQrCaption: (caption: string) => void;
  setShowQrCaption: (on: boolean) => void;
  setQrDestination: (dest: "custom" | "archivio-share") => void;

  // Algorithm
  algorithm: string;
  printBrightness: string;
  setAlgorithm: (algo: string) => void;
  setPrintBrightness: (preset: string) => void;

  // Stamps (date, time, location)
  dateStampEnabled: boolean;
  timeStampEnabled: boolean;
  locationStampEnabled: boolean;
  locationText: string;
  stampEnabled: boolean;
  stampText: string;
  dateFormat: string;
  timeFormat: string;
  setDateStampEnabled: (on: boolean) => void;
  setTimeStampEnabled: (on: boolean) => void;
  setLocationStampEnabled: (on: boolean) => void;
  setLocationText: (text: string) => void;
  toggleStamp: () => void;
  setStampText: (text: string) => void;
  setDateFormat: (fmt: string) => void;
  setTimeFormat: (fmt: string) => void;

  // Stickers (receipt stage size used to place new stickers near center)
  receiptStageWidth: number;
  receiptStageHeight: number;
  setReceiptStageSize: (w: number, h: number) => void;
  stickerLibrary: { id: string; src: string }[];
  stickers: Sticker[];
  addStickerToLibrary: (src: string) => void;
  removeStickerFromLibrary: (id: string) => void;
  updateStickerLibraryItem: (id: string, newSrc: string) => void;
  addSticker: (src: string, imgW?: number, imgH?: number) => void;
  updateSticker: (id: string, updates: Partial<Sticker>) => void;
  removeSticker: (id: string) => void;

  // Shared asset library (used by both dashboard and templates)
  assetLibrary: { id: string; src: string; name: string; type: "image" | "sticker" }[];
  addAsset: (asset: { id: string; src: string; name: string; type: "image" | "sticker" }) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<{ src: string; name: string }>) => void;

  // Event mode (name, date, location applied to all prints when enabled)
  eventModeEnabled: boolean;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  setEventModeEnabled: (on: boolean) => void;
  setEventName: (v: string) => void;
  setEventDate: (v: string) => void;
  setEventLocation: (v: string) => void;

  // Receipt height override (0 = auto from content)
  receiptHeightOverride: number;
  setReceiptHeightOverride: (h: number) => void;

  // Active template loaded in dashboard (null = freeform mode)
  activeTemplate: ActiveTemplate | null;
  setActiveTemplate: (tpl: ActiveTemplate | null) => void;

  // Section order
  sectionOrder: string[];
  setSectionOrder: (order: string[]) => void;

  // Print copies
  printCopies: number;
  setPrintCopies: (n: number) => void;

  // Multi-photo capture
  multiCaptureCount: number;
  multiCaptureLayout: "separate" | "single";
  setMultiCaptureCount: (n: number) => void;
  setMultiCaptureLayout: (layout: "separate" | "single") => void;

  // Share service (archivio-share)
  shareServiceOnline: boolean;
  setShareServiceOnline: (v: boolean) => void;

  // Print queue
  printQueue: PrintJob[];
  addPrintJob: (id: string) => void;
  updatePrintJob: (id: string, status: PrintJob["status"], message?: string) => void;
  clearDoneJobs: () => void;
  removePrintJob: (id: string) => void;
}

const GRID_LAYOUT_OPTIONS: Record<number, string[]> = {
  1: ["1-full"],
  2: ["2-side", "2-stack", "2-big-small", "2-diagonal"],
  3: ["3-left", "3-top", "3-cols", "3-right", "3-strip"],
  4: ["4-grid", "4-left", "4-top", "4-strip", "4-diamond", "4-masonry"],
  5: ["5-left", "5-grid", "5-cross", "5-magazine"],
  6: ["6-grid", "6-mosaic", "6-magazine", "6-strip"],
};

let _uid = 0;
const uid = () => `_${Date.now()}_${++_uid}`;

/** Convert a blob:// URL to a data:// URL so it survives localStorage persistence. */
function blobToDataUrl(blobUrl: string): Promise<string> {
  return fetch(blobUrl)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

export const useBoothStore = create<BoothStore>()(
  persist(
    (set, get) => ({
  // Cafe identification
  cafeSlug: "",
  setCafeSlug: (slug: string) => set({ cafeSlug: slug }),

  // Connection
  piConnected: false,
  cameraAvailable: false,
  printerAvailable: false,
  setPiStatus: (connected, camera, printer) =>
    set({ piConnected: connected, cameraAvailable: camera, printerAvailable: printer }),

  // Canvas selection
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // Logo — starts blank
  logoPreview: null,
  logoOriginalPreview: null,
  logoFilename: "",
  logoCrop: null,
  headerHeight: 64,
  headerTextEnabled: false,
  headerText: "",
  headerTextFont: "Inter",
  headerTextSize: 12,
  headerTextBold: false,
  headerTextItalic: false,
  headerTextUnderline: false,
  setLogo: (preview, filename) => set((s) => ({
    logoPreview: preview,
    logoFilename: filename,
    logoOriginalPreview: s.logoOriginalPreview ?? preview,
  })),
  setLogoOriginal: (url) => set({ logoOriginalPreview: url }),
  resetLogoToOriginal: () => set((s) => ({
    logoPreview: s.logoOriginalPreview,
    logoCrop: null,
  })),
  clearLogo: () => set({ logoPreview: null, logoOriginalPreview: null, logoFilename: "", logoCrop: null }),
  setLogoCrop: (crop) => set({ logoCrop: crop }),
  setHeaderHeight: (h) => set({ headerHeight: h }),
  setHeaderTextEnabled: (on) => set({ headerTextEnabled: on }),
  setHeaderText: (text) => set({ headerText: text }),
  setHeaderTextFont: (font) => set({ headerTextFont: font }),
  setHeaderTextSize: (size) => set({ headerTextSize: size }),
  setHeaderTextBold: (on) => set({ headerTextBold: on }),
  setHeaderTextItalic: (on) => set({ headerTextItalic: on }),
  setHeaderTextUnderline: (on) => set({ headerTextUnderline: on }),

  // Photo
  photoMode: "single",
  setPhotoMode: (mode) => set({ photoMode: mode }),
  photoPreview: null,
  photoOriginalPreview: null,
  photoFilename: "",
  photoCrop: null,
  photoAspectRatio: "free",
  photoRotation: 0,
  photoFilter: "none",
  photoBorderId: "none",
  setPhoto: (preview, filename) => set((s) => ({
    photoPreview: preview,
    photoFilename: filename,
    photoOriginalPreview: s.photoOriginalPreview ?? preview,
  })),
  setPhotoOriginal: (url) => set({ photoOriginalPreview: url }),
  resetPhotoToOriginal: () => set((s) => ({
    photoPreview: s.photoOriginalPreview,
    photoCrop: null,
    photoRotation: 0,
  })),
  clearPhoto: () => set({ photoPreview: null, photoOriginalPreview: null, photoFilename: "", photoCrop: null, photoRotation: 0 }),
  setPhotoCrop: (crop) => set({ photoCrop: crop }),
  setPhotoAspectRatio: (ratio) => set({ photoAspectRatio: ratio }),
  setPhotoRotation: (deg) => set({ photoRotation: deg }),
  setPhotoFilter: (filter) => set({ photoFilter: filter }),
  setPhotoBorderId: (id) => set({ photoBorderId: id }),

  // Grid
  gridPhotos: [],
  gridLayout: "2-side",
  gridCanvasMode: false,
  addGridPhoto: (photo) => set((s) => ({ gridPhotos: [...s.gridPhotos, photo] })),
  removeGridPhoto: (id) => set((s) => ({ gridPhotos: s.gridPhotos.filter((p) => p.id !== id) })),
  updateGridPhotoCrop: (id, crop) =>
    set((s) => ({
      gridPhotos: s.gridPhotos.map((p) => (p.id === id ? { ...p, cropData: crop } : p)),
    })),
  shuffleGridLayout: () => {
    const { gridPhotos, gridLayout } = get();
    const count = Math.min(gridPhotos.length, 6);
    const options = GRID_LAYOUT_OPTIONS[count] || GRID_LAYOUT_OPTIONS[1];
    const idx = options.indexOf(gridLayout);
    const next = options[(idx + 1) % options.length];
    set({ gridLayout: next });
  },
  setGridLayout: (layout) => set({ gridLayout: layout }),
  setGridCanvasMode: (on) => set({ gridCanvasMode: on }),
  updateGridPhotoPos: (id, updates) =>
    set((s) => ({
      gridPhotos: s.gridPhotos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  updateGridPhoto: (id, updates) =>
    set((s) => ({
      gridPhotos: s.gridPhotos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  // Memo
  memo: "",
  memoFont: "Inter",
  memoFontSize: 14,
  memoBold: false,
  memoItalic: false,
  memoUnderline: false,
  savedMemos: [],
  setMemo: (memo) => set({ memo }),
  setMemoFont: (font) => set({ memoFont: font }),
  setMemoFontSize: (size) => set({ memoFontSize: size }),
  setMemoBold: (on) => set({ memoBold: on }),
  setMemoItalic: (on) => set({ memoItalic: on }),
  setMemoUnderline: (on) => set({ memoUnderline: on }),
  addSavedMemo: (text) => set((s) => {
    const trimmed = text.trim();
    if (!trimmed || s.savedMemos.includes(trimmed)) return s;
    return { savedMemos: [...s.savedMemos, trimmed] };
  }),
  removeSavedMemo: (text) => set((s) => ({ savedMemos: s.savedMemos.filter((m) => m !== text) })),

  // QR
  qrEnabled: true,
  qrUrl: "https://archivio.app",
  qrSize: 64,
  qrCaption: "scan for your digital copy",
  showQrCaption: true,
  qrDestination: "archivio-share",
  setQrEnabled: (on) => set({ qrEnabled: on }),
  setQrUrl: (qrUrl) => set({ qrUrl }),
  setQrSize: (qrSize) => set({ qrSize }),
  setQrCaption: (caption) => set({ qrCaption: caption }),
  setShowQrCaption: (on) => set({ showQrCaption: on }),
  setQrDestination: (qrDestination) => set({ qrDestination }),

  // Algorithm
  algorithm: "atkinson",
  printBrightness: "medium",
  setAlgorithm: (algorithm) => set({ algorithm }),
  setPrintBrightness: (printBrightness) => set({ printBrightness }),

  // Stamps
  dateStampEnabled: false,
  timeStampEnabled: false,
  locationStampEnabled: false,
  locationText: "",
  stampEnabled: false,
  stampText: "",
  dateFormat: "short",
  timeFormat: "12h",
  setDateFormat: (fmt) => set({ dateFormat: fmt }),
  setTimeFormat: (fmt) => set({ timeFormat: fmt }),
  setDateStampEnabled: (on) => set((s) => ({ dateStampEnabled: on, stampEnabled: on || s.timeStampEnabled || s.locationStampEnabled })),
  setTimeStampEnabled: (on) => set((s) => ({ timeStampEnabled: on, stampEnabled: s.dateStampEnabled || on || s.locationStampEnabled })),
  setLocationStampEnabled: (on) => set((s) => ({ locationStampEnabled: on, stampEnabled: s.dateStampEnabled || s.timeStampEnabled || on })),
  setLocationText: (text) => set({ locationText: text }),
  toggleStamp: () => set((s) => {
    const next = !s.stampEnabled;
    return { stampEnabled: next, dateStampEnabled: next, timeStampEnabled: next };
  }),
  setStampText: (stampText) => set({ stampText }),

  // Receipt stage size (set by ReceiptCanvas so new stickers are placed near center)
  receiptStageWidth: 280,
  receiptStageHeight: 400,
  setReceiptStageSize: (w, h) => set({ receiptStageWidth: w, receiptStageHeight: h }),
  stickerLibrary: [],
  stickers: [],
  addStickerToLibrary: (src) => {
    const id = uid();
    // Immediately add with current URL, then convert blob→data URL in background for persistence
    set((s) => ({ stickerLibrary: [...s.stickerLibrary, { id, src }] }));
    if (src.startsWith("blob:")) {
      blobToDataUrl(src).then((dataUrl) => {
        set((s) => ({
          stickerLibrary: s.stickerLibrary.map((x) => (x.id === id ? { ...x, src: dataUrl } : x)),
        }));
      }).catch(() => {}); // keep blob URL as fallback
    }
  },
  removeStickerFromLibrary: (id) =>
    set((s) => ({ stickerLibrary: s.stickerLibrary.filter((x) => x.id !== id) })),
  updateStickerLibraryItem: (id, newSrc) => {
    set((s) => ({ stickerLibrary: s.stickerLibrary.map((x) => (x.id === id ? { ...x, src: newSrc } : x)) }));
    if (newSrc.startsWith("blob:")) {
      blobToDataUrl(newSrc).then((dataUrl) => {
        set((s) => ({
          stickerLibrary: s.stickerLibrary.map((x) => (x.id === id ? { ...x, src: dataUrl } : x)),
        }));
      }).catch(() => {});
    }
  },
  addSticker: (src, imgW?, imgH?) =>
    set((s) => {
      const stageW = s.receiptStageWidth ?? 280;
      const stageH = s.receiptStageHeight ?? 400;
      // Use actual image dimensions; fit within 80px max side, preserving aspect ratio
      const maxSide = 80;
      let stickerW = maxSide;
      let stickerH = maxSide;
      if (imgW && imgH && imgW > 0 && imgH > 0) {
        const scale = Math.min(maxSide / imgW, maxSide / imgH);
        stickerW = Math.round(imgW * scale);
        stickerH = Math.round(imgH * scale);
      }
      const x = Math.round(stageW / 2 - stickerW / 2);
      const y = Math.round(stageH / 2 - stickerH / 2);
      return {
        stickers: [...s.stickers, { id: uid(), src, x, y, width: stickerW, height: stickerH, rotation: 0 }],
      };
    }),
  updateSticker: (id, updates) =>
    set((s) => ({ stickers: s.stickers.map((st) => (st.id === id ? { ...st, ...updates } : st)) })),
  removeSticker: (id) => set((s) => ({ stickers: s.stickers.filter((st) => st.id !== id) })),

  // Shared asset library
  assetLibrary: [],
  addAsset: (asset) => {
    // Immediately add, then convert blob→data URL in background for persistence
    set((s) => ({ assetLibrary: [...s.assetLibrary, asset] }));
    if (asset.src.startsWith("blob:")) {
      blobToDataUrl(asset.src).then((dataUrl) => {
        set((s) => ({
          assetLibrary: s.assetLibrary.map((a) => (a.id === asset.id ? { ...a, src: dataUrl } : a)),
        }));
      }).catch(() => {}); // keep blob URL as fallback
    }
  },
  removeAsset: (id) => set((s) => ({ assetLibrary: s.assetLibrary.filter((a) => a.id !== id) })),
  updateAsset: (id, updates) => {
    set((s) => ({
      assetLibrary: s.assetLibrary.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
    // If updating src with a blob URL, convert to data URL in background
    if (updates.src && updates.src.startsWith("blob:")) {
      blobToDataUrl(updates.src).then((dataUrl) => {
        set((s) => ({
          assetLibrary: s.assetLibrary.map((a) => (a.id === id ? { ...a, src: dataUrl } : a)),
        }));
      }).catch(() => {});
    }
  },

  eventModeEnabled: false,
  eventName: "",
  eventDate: "",
  eventLocation: "",
  setEventModeEnabled: (on) => set({ eventModeEnabled: on }),
  setEventName: (v) => set({ eventName: v }),
  setEventDate: (v) => set({ eventDate: v }),
  setEventLocation: (v) => set({ eventLocation: v }),

  receiptHeightOverride: 0,
  setReceiptHeightOverride: (h) => set({ receiptHeightOverride: h }),

  activeTemplate: null,
  setActiveTemplate: (tpl) => set({ activeTemplate: tpl }),

  sectionOrder: ["logo", "photo", "memo", "qr", "stamp"],
  setSectionOrder: (sectionOrder) => set({ sectionOrder }),

  // Print copies
  printCopies: 1,
  setPrintCopies: (n) => set({ printCopies: n }),

  // Multi-photo capture
  multiCaptureCount: 1,
  multiCaptureLayout: "separate",
  setMultiCaptureCount: (n) => set({ multiCaptureCount: n }),
  setMultiCaptureLayout: (layout) => set({ multiCaptureLayout: layout }),

  // Print queue
  shareServiceOnline: false,
  setShareServiceOnline: (v) => set({ shareServiceOnline: v }),

  printQueue: [],
  addPrintJob: (id) =>
    set((s) => ({
      printQueue: [{ id, status: "pending", timestamp: Date.now() }, ...s.printQueue],
    })),
  updatePrintJob: (id, status, message) =>
    set((s) => ({
      printQueue: s.printQueue.map((j) => (j.id === id ? { ...j, status, message } : j)),
    })),
  clearDoneJobs: () =>
    set((s) => ({ printQueue: s.printQueue.filter((j) => j.status !== "done") })),
  removePrintJob: (id) =>
    set((s) => ({ printQueue: s.printQueue.filter((j) => j.id !== id) })),
    }),
    {
      name: "booth-storage",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        stickerLibrary: state.stickerLibrary,
        assetLibrary: state.assetLibrary,
        savedMemos: state.savedMemos,
        algorithm: state.algorithm,
        printBrightness: state.printBrightness,
        memoFont: state.memoFont,
        memoFontSize: state.memoFontSize,
        headerTextFont: state.headerTextFont,
        qrUrl: state.qrUrl,
        qrSize: state.qrSize,
        qrDestination: state.qrDestination,
        dateFormat: state.dateFormat,
        timeFormat: state.timeFormat,
        locationText: state.locationText,
        multiCaptureCount: state.multiCaptureCount,
        multiCaptureLayout: state.multiCaptureLayout,
        printCopies: state.printCopies,
        receiptHeightOverride: state.receiptHeightOverride,
      }),
      // v0→v1: removed "low" brightness & vintage/contrast/grayscale filters for thermal optimisation
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0) {
          // Reset removed brightness preset
          if (state.printBrightness === "low") state.printBrightness = "medium";
        }
        return state;
      },
    }
  )
);
