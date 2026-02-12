import { create } from "zustand";

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
}

export interface PrintJob {
  id: string;
  status: "pending" | "printing" | "done" | "error";
  message?: string;
  timestamp: number;
}

export type AspectRatio = "1:1" | "4:3" | "3:4" | "4:5" | "5:4" | "9:16" | "16:9" | "2:3" | "3:2" | "free";

export interface BoothStore {
  // Connection
  piConnected: boolean;
  cameraAvailable: boolean;
  printerAvailable: boolean;
  setPiStatus: (connected: boolean, camera: boolean, printer: boolean) => void;

  // Logo
  logoPreview: string | null;
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
  photoFilename: string;
  photoCrop: CropData | null;
  photoAspectRatio: AspectRatio;
  photoRotation: number;
  setPhoto: (preview: string, filename: string) => void;
  clearPhoto: () => void;
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

  // Memo
  memo: string;
  memoFont: string;
  memoFontSize: number;
  memoBold: boolean;
  memoItalic: boolean;
  memoUnderline: boolean;
  setMemo: (memo: string) => void;
  setMemoFont: (font: string) => void;
  setMemoFontSize: (size: number) => void;
  setMemoBold: (on: boolean) => void;
  setMemoItalic: (on: boolean) => void;
  setMemoUnderline: (on: boolean) => void;

  // QR
  qrUrl: string;
  qrSize: number;
  setQrUrl: (url: string) => void;
  setQrSize: (size: number) => void;

  // Algorithm
  algorithm: string;
  setAlgorithm: (algo: string) => void;

  // Stamps (date, time, location)
  dateStampEnabled: boolean;
  timeStampEnabled: boolean;
  locationStampEnabled: boolean;
  locationText: string;
  stampEnabled: boolean; // legacy — true if any stamp is enabled
  stampText: string; // composed stamp text
  setDateStampEnabled: (on: boolean) => void;
  setTimeStampEnabled: (on: boolean) => void;
  setLocationStampEnabled: (on: boolean) => void;
  setLocationText: (text: string) => void;
  toggleStamp: () => void; // legacy compat
  setStampText: (text: string) => void;

  // Stickers
  stickerLibrary: { id: string; src: string }[];
  stickers: Sticker[];
  addStickerToLibrary: (src: string) => void;
  removeStickerFromLibrary: (id: string) => void;
  updateStickerLibraryItem: (id: string, newSrc: string) => void;
  addSticker: (src: string) => void;
  updateSticker: (id: string, updates: Partial<Sticker>) => void;
  removeSticker: (id: string) => void;

  // Section order
  sectionOrder: string[];
  setSectionOrder: (order: string[]) => void;

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

export const useBoothStore = create<BoothStore>((set, get) => ({
  // Connection
  piConnected: false,
  cameraAvailable: false,
  printerAvailable: false,
  setPiStatus: (connected, camera, printer) =>
    set({ piConnected: connected, cameraAvailable: camera, printerAvailable: printer }),

  // Logo — starts blank (no default)
  logoPreview: null,
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
  setLogo: (preview, filename) => set({ logoPreview: preview, logoFilename: filename }),
  clearLogo: () => set({ logoPreview: null, logoFilename: "", logoCrop: null }),
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
  photoFilename: "",
  photoCrop: null,
  photoAspectRatio: "free",
  photoRotation: 0,
  setPhoto: (preview, filename) => set({ photoPreview: preview, photoFilename: filename }),
  clearPhoto: () => set({ photoPreview: null, photoFilename: "", photoCrop: null, photoRotation: 0 }),
  setPhotoCrop: (crop) => set({ photoCrop: crop }),
  setPhotoAspectRatio: (ratio) => set({ photoAspectRatio: ratio }),
  setPhotoRotation: (deg) => set({ photoRotation: deg }),

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

  // Memo
  memo: "",
  memoFont: "Inter",
  memoFontSize: 14,
  memoBold: false,
  memoItalic: false,
  memoUnderline: false,
  setMemo: (memo) => set({ memo }),
  setMemoFont: (font) => set({ memoFont: font }),
  setMemoFontSize: (size) => set({ memoFontSize: size }),
  setMemoBold: (on) => set({ memoBold: on }),
  setMemoItalic: (on) => set({ memoItalic: on }),
  setMemoUnderline: (on) => set({ memoUnderline: on }),

  // QR
  qrUrl: "https://youmee.app",
  qrSize: 64,
  setQrUrl: (qrUrl) => set({ qrUrl }),
  setQrSize: (qrSize) => set({ qrSize }),

  // Algorithm
  algorithm: "atkinson",
  setAlgorithm: (algorithm) => set({ algorithm }),

  // Stamps
  dateStampEnabled: false,
  timeStampEnabled: false,
  locationStampEnabled: false,
  locationText: "",
  stampEnabled: false,
  stampText: "",
  setDateStampEnabled: (on) => set((s) => ({ dateStampEnabled: on, stampEnabled: on || s.timeStampEnabled || s.locationStampEnabled })),
  setTimeStampEnabled: (on) => set((s) => ({ timeStampEnabled: on, stampEnabled: s.dateStampEnabled || on || s.locationStampEnabled })),
  setLocationStampEnabled: (on) => set((s) => ({ locationStampEnabled: on, stampEnabled: s.dateStampEnabled || s.timeStampEnabled || on })),
  setLocationText: (text) => set({ locationText: text }),
  toggleStamp: () => set((s) => {
    const next = !s.stampEnabled;
    return { stampEnabled: next, dateStampEnabled: next, timeStampEnabled: next };
  }),
  setStampText: (stampText) => set({ stampText }),

  // Sticker library + placed stickers
  stickerLibrary: [],
  stickers: [],
  addStickerToLibrary: (src) =>
    set((s) => ({ stickerLibrary: [...s.stickerLibrary, { id: uid(), src }] })),
  removeStickerFromLibrary: (id) =>
    set((s) => ({ stickerLibrary: s.stickerLibrary.filter((x) => x.id !== id) })),
  updateStickerLibraryItem: (id, newSrc) =>
    set((s) => ({ stickerLibrary: s.stickerLibrary.map((x) => (x.id === id ? { ...x, src: newSrc } : x)) })),
  addSticker: (src) =>
    set((s) => ({
      stickers: [...s.stickers, { id: uid(), src, x: 80, y: 200, width: 60, height: 60 }],
    })),
  updateSticker: (id, updates) =>
    set((s) => ({ stickers: s.stickers.map((st) => (st.id === id ? { ...st, ...updates } : st)) })),
  removeSticker: (id) => set((s) => ({ stickers: s.stickers.filter((st) => st.id !== id) })),

  // Section order
  sectionOrder: ["logo", "photo", "memo", "qr", "stamp"],
  setSectionOrder: (sectionOrder) => set({ sectionOrder }),

  // Print queue
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
}));
