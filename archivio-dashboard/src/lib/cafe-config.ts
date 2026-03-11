import { create } from "zustand";
import { api } from "@/lib/api";

/**
 * Feature flags controlling what the cafe operator can access.
 * When running outside the platform iframe, all flags default to true.
 */
export interface CafeFeatureFlags {
  canUploadPhoto: boolean;
  canUseCamera: boolean;
  canUseMultiCapture: boolean;
  canUseGridMode: boolean;
  canChangeFilter: boolean;
  canChangeBorder: boolean;
  canChangeAspectRatio: boolean;
  canRotatePhoto: boolean;
  canUseStickers: boolean;
  canUploadStickers: boolean;
  canEditMemo: boolean;
  canEditHeaderText: boolean;
  canChangeFont: boolean;
  canChangePrintStyle: boolean;
  canChangeBrightness: boolean;
  canChangeCopies: boolean;
  maxCopies: number;
  canEditQr: boolean;
  canEditStamps: boolean;
  canReorderSections: boolean;
  canShareDigital: boolean;
  canDownloadImage: boolean;
  canSelectTemplate: boolean;
  canCreateTemplate: boolean;
}

export interface CafeConfigState {
  /** Whether this dashboard is running inside the platform iframe */
  embedded: boolean;
  cafeId: string | null;
  cafeName: string | null;
  features: CafeFeatureFlags;
  /** Locked template state (JSON) — if set, operator starts from this template */
  templateState: string | null;
  /** Fields that are locked in the template and cannot be changed by operator */
  lockedFields: string[];
  /** User role: super_admin can override locks */
  userRole: string | null;
  /** Config defaults from the admin (branding, print settings, etc.) */
  configDefaults: Record<string, unknown> | null;

  /** Apply config received from platform postMessage */
  applyConfig: (payload: {
    cafeId: string;
    cafeName: string;
    config: Record<string, unknown> | null;
    features: CafeFeatureFlags | null;
    template: {
      id: string;
      name: string;
      lockedFields: string[];
      state: string | null;
    } | null;
    userRole: string;
  }) => void;

  /** Check if a specific feature is enabled */
  can: (flag: keyof CafeFeatureFlags) => boolean;

  /** Check if a specific field is locked by the template */
  isLocked: (field: string) => boolean;
}

const ALL_ENABLED: CafeFeatureFlags = {
  canUploadPhoto: true,
  canUseCamera: true,
  canUseMultiCapture: true,
  canUseGridMode: true,
  canChangeFilter: true,
  canChangeBorder: true,
  canChangeAspectRatio: true,
  canRotatePhoto: true,
  canUseStickers: true,
  canUploadStickers: true,
  canEditMemo: true,
  canEditHeaderText: true,
  canChangeFont: true,
  canChangePrintStyle: true,
  canChangeBrightness: true,
  canChangeCopies: true,
  maxCopies: 10,
  canEditQr: true,
  canEditStamps: true,
  canReorderSections: true,
  canShareDigital: true,
  canDownloadImage: true,
  canSelectTemplate: true,
  canCreateTemplate: true,
};

export const useCafeConfig = create<CafeConfigState>()((set, get) => ({
  embedded: false,
  cafeId: null,
  cafeName: null,
  features: ALL_ENABLED,
  templateState: null,
  lockedFields: [],
  userRole: null,
  configDefaults: null,

  applyConfig: (payload) => {
    set({
      embedded: true,
      cafeId: payload.cafeId,
      cafeName: payload.cafeName,
      features: payload.features ?? ALL_ENABLED,
      templateState: payload.template?.state ?? null,
      lockedFields: payload.template?.lockedFields ?? [],
      userRole: payload.userRole,
      configDefaults: payload.config,
    });
  },

  can: (flag) => {
    const state = get();
    // Super admins can do everything
    if (state.userRole === "super_admin") return true;
    // When not embedded, all features are available
    if (!state.embedded) return true;
    const val = state.features[flag];
    if (typeof val === "boolean") return val;
    return true;
  },

  isLocked: (field) => {
    const state = get();
    // Super admins can override locks
    if (state.userRole === "super_admin") return false;
    // When not embedded, nothing is locked
    if (!state.embedded) return false;
    return state.lockedFields.includes(field);
  },
}));

/**
 * Initialize the cafe config listener.
 * Call this once in the dashboard's main page component.
 * Listens for postMessage events from the platform iframe parent.
 */
export function initCafeConfigListener() {
  if (typeof window === "undefined") return;

  // Check if we're embedded (URL has ?embedded=true)
  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get("embedded") === "true";

  if (!isEmbedded) return;

  window.addEventListener("message", (event) => {
    // Validate origin — only accept messages from the parent window's origin.
    // In an iframe, document.referrer contains the parent page URL.
    if (event.origin) {
      const referrerOrigin = (() => {
        try {
          return document.referrer ? new URL(document.referrer).origin : null;
        } catch {
          return null;
        }
      })();

      // Accept if origin matches the referrer (platform that loaded this iframe),
      // or if same-origin (for local dev / testing).
      if (
        referrerOrigin &&
        event.origin !== referrerOrigin &&
        event.origin !== window.location.origin
      ) {
        console.warn(
          "[cafe-config] Rejected postMessage from unexpected origin:",
          event.origin
        );
        return;
      }
    }

    if (event.data?.type === "archivio:cafe-config") {
      useCafeConfig.getState().applyConfig(event.data.payload);
    }
  });
}

/**
 * Load cafe config directly from the Pi server.
 * Used when the dashboard runs standalone on the Pi (not embedded in platform iframe).
 */
export async function loadConfigFromPi(): Promise<void> {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("embedded") === "true") return; // iframe mode uses postMessage instead

  try {
    const data = await api.getConfig();
    if (!data || Object.keys(data).length <= 1) return; // empty or only _updatedAt

    const features = (data.features as CafeFeatureFlags) ?? undefined;
    const template = data.templateState
      ? {
          id: (data.templateId as string) ?? "pi-default",
          name: (data.templateName as string) ?? "Default",
          lockedFields: (data.lockedFields as string[]) ?? [],
          state: data.templateState as string,
        }
      : null;

    useCafeConfig.getState().applyConfig({
      cafeId: (data.cafeId as string) ?? "local",
      cafeName: (data.cafeName as string) ?? "",
      config: data,
      features: features ?? null,
      template,
      userRole: (data.userRole as string) ?? "cafe_operator",
    });
  } catch {
    // Pi config not available — all features stay enabled
  }
}
