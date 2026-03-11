// ── Roles ────────────────────────────────────────────────
export type UserRole = "super_admin" | "cafe_admin" | "cafe_operator";

// ── Cafe ─────────────────────────────────────────────────
export interface Cafe {
  id: string;
  name: string;
  slug: string; // URL-safe identifier, e.g. "blue-bottle-sf"
  logoUrl: string | null;
  piServerUrl: string | null; // e.g. "http://192.168.1.50:5000"
  plan: "free" | "pro" | "enterprise";
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Cafe Config (controls what operators see and can do) ──
export interface CafeConfig {
  cafeId: string;

  // Branding — locked by admin, operators can't change
  logoUrl: string | null;
  headerText: string;
  headerTextFont: string;
  headerTextSize: number;
  headerTextBold: boolean;
  headerTextItalic: boolean;
  headerHeight: number;

  // Print settings — admin locks these for consistency
  algorithm: string; // "atkinson" | "floyd_steinberg" | "stucki" | "bayer8"
  printBrightness: string; // "low" | "medium" | "high"
  photoBorderId: string;
  photoFilter: string;

  // Feature flags — admin controls which features the cafe has access to
  features: CafeFeatureFlags;

  // Layout
  sectionOrder: string[]; // ["logo", "photo", "memo", "qr", "stamp"]
  photoAspectRatio: string;

  // QR
  qrEnabled: boolean;
  qrUrl: string;
  qrCaption: string;

  // Stamps
  dateStampEnabled: boolean;
  timeStampEnabled: boolean;
  locationStampEnabled: boolean;
  locationText: string;

  // Memo defaults
  defaultMemo: string;
  memoFont: string;
  memoFontSize: number;

  // Event mode
  eventModeEnabled: boolean;
  eventName: string;
  eventDate: string;
  eventLocation: string;
}

// ── Feature flags — what operators can access ────────────
export interface CafeFeatureFlags {
  // Photo features
  canUploadPhoto: boolean;
  canUseCamera: boolean;
  canUseMultiCapture: boolean;
  canUseGridMode: boolean;
  canChangeFilter: boolean;
  canChangeBorder: boolean;
  canChangeAspectRatio: boolean;
  canRotatePhoto: boolean;

  // Stickers
  canUseStickers: boolean;
  canUploadStickers: boolean;

  // Text
  canEditMemo: boolean;
  canEditHeaderText: boolean;
  canChangeFont: boolean;

  // Print controls
  canChangePrintStyle: boolean;
  canChangeBrightness: boolean;
  canChangeCopies: boolean;
  maxCopies: number;

  // QR
  canEditQr: boolean;

  // Stamps
  canEditStamps: boolean;

  // Section reordering
  canReorderSections: boolean;

  // Sharing
  canShareDigital: boolean;
  canDownloadImage: boolean;

  // Templates
  canSelectTemplate: boolean;
  canCreateTemplate: boolean;
}

// ── Template ─────────────────────────────────────────────
export interface CafeTemplate {
  id: string;
  cafeId: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  // Full serialized booth-store state (JSON)
  state: string;
  // Which fields in the state are "locked" (operator cannot modify)
  lockedFields: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── User (stored in platform DB, linked to Supabase auth) ─
export interface PlatformUser {
  id: string;
  supabaseId: string; // Supabase auth user ID
  email: string;
  name: string;
  role: UserRole;
  cafeId: string | null; // null for super_admin
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── API response wrappers ────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ── Default feature flags (used when creating new cafes) ──
export const DEFAULT_FEATURE_FLAGS: CafeFeatureFlags = {
  canUploadPhoto: true,
  canUseCamera: true,
  canUseMultiCapture: false,
  canUseGridMode: false,
  canChangeFilter: false,
  canChangeBorder: false,
  canChangeAspectRatio: false,
  canRotatePhoto: true,
  canUseStickers: false,
  canUploadStickers: false,
  canEditMemo: true,
  canEditHeaderText: false,
  canChangeFont: false,
  canChangePrintStyle: false,
  canChangeBrightness: false,
  canChangeCopies: true,
  maxCopies: 3,
  canEditQr: false,
  canEditStamps: false,
  canReorderSections: false,
  canShareDigital: true,
  canDownloadImage: true,
  canSelectTemplate: true,
  canCreateTemplate: false,
};

// ── Default cafe config ──────────────────────────────────
export const DEFAULT_CAFE_CONFIG: Omit<CafeConfig, "cafeId"> = {
  logoUrl: null,
  headerText: "",
  headerTextFont: "Inter",
  headerTextSize: 12,
  headerTextBold: false,
  headerTextItalic: false,
  headerHeight: 64,
  algorithm: "atkinson",
  printBrightness: "medium",
  photoBorderId: "none",
  photoFilter: "none",
  features: DEFAULT_FEATURE_FLAGS,
  sectionOrder: ["logo", "photo", "memo", "qr", "stamp"],
  photoAspectRatio: "free",
  qrEnabled: false,
  qrUrl: "",
  qrCaption: "",
  dateStampEnabled: false,
  timeStampEnabled: false,
  locationStampEnabled: false,
  locationText: "",
  defaultMemo: "",
  memoFont: "Inter",
  memoFontSize: 14,
  eventModeEnabled: false,
  eventName: "",
  eventDate: "",
  eventLocation: "",
};
