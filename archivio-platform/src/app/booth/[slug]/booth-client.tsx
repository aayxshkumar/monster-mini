"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CafeFeatureFlags, UserRole } from "@/types";

interface CafeInfo {
  id: string;
  name: string;
  slug: string;
  piServerUrl: string | null;
  logoUrl: string | null;
}

interface CafeConfigData {
  logoUrl: string | null;
  headerText: string;
  headerTextFont: string;
  headerTextSize: number;
  headerHeight: number;
  algorithm: string;
  printBrightness: string;
  photoBorderId: string;
  photoFilter: string;
  photoAspectRatio: string;
  sectionOrder: string[];
  qrEnabled: boolean;
  qrUrl: string;
  qrCaption: string;
  dateStampEnabled: boolean;
  timeStampEnabled: boolean;
  locationStampEnabled: boolean;
  locationText: string;
  defaultMemo: string;
  memoFont: string;
  memoFontSize: number;
  eventModeEnabled: boolean;
  eventName: string;
  eventDate: string;
  eventLocation: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  isDefault: boolean;
  lockedFields: string[];
  state: string;
}

interface Props {
  cafe: CafeInfo;
  config: CafeConfigData | null;
  features: CafeFeatureFlags | null;
  templates: TemplateInfo[];
  user: { name: string; role: UserRole };
}

/**
 * Booth client component.
 *
 * This page renders an iframe pointing to the archivio-dashboard running on
 * the cafe's Pi server, passing the cafe config + feature flags via
 * postMessage. The dashboard reads these and locks/hides features accordingly.
 *
 * Alternatively, if the Pi is unreachable, it shows a configuration summary
 * and instructions.
 */
export function BoothClient({
  cafe,
  config,
  features,
  templates,
  user,
}: Props) {
  const [piStatus, setPiStatus] = useState<"checking" | "online" | "offline">(
    "checking"
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? null
  );

  const piUrl = cafe.piServerUrl;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /** Derive a safe targetOrigin from the Pi URL (never use "*") */
  const targetOrigin = (() => {
    if (!piUrl) return null;
    try {
      const u = new URL(piUrl);
      return u.origin;
    } catch {
      return null;
    }
  })();

  // Health check the Pi server
  useEffect(() => {
    if (!piUrl) {
      setPiStatus("offline");
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${piUrl}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          setPiStatus(res.ok ? "online" : "offline");
        }
      } catch {
        if (!cancelled) setPiStatus("offline");
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [piUrl]);

  /** Build the config message to send to the dashboard iframe */
  const buildConfigMessage = useCallback(() => {
    const currentTemplate = templates.find((t) => t.id === selectedTemplate);
    return {
      type: "archivio:cafe-config",
      payload: {
        cafeId: cafe.id,
        cafeName: cafe.name,
        config,
        features,
        template: currentTemplate
          ? {
              id: currentTemplate.id,
              name: currentTemplate.name,
              lockedFields: currentTemplate.lockedFields,
              state: currentTemplate.state,
            }
          : null,
        userRole: user.role,
      },
    };
  }, [cafe, config, features, templates, selectedTemplate, user.role]);

  /** Send config to dashboard iframe on load */
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !targetOrigin) return;
    iframe.contentWindow.postMessage(buildConfigMessage(), targetOrigin);
  }, [buildConfigMessage, targetOrigin]);

  /** Re-send config when selectedTemplate changes (after initial load) */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !targetOrigin) return;
    // Only send if iframe is already loaded (has a contentDocument)
    try {
      if (iframe.contentDocument?.readyState === "complete") {
        iframe.contentWindow.postMessage(buildConfigMessage(), targetOrigin);
      }
    } catch {
      // Cross-origin iframe — readyState is not accessible, but that means
      // the iframe IS loaded (from another origin). Safe to postMessage.
      iframe.contentWindow.postMessage(buildConfigMessage(), targetOrigin);
    }
  }, [selectedTemplate, buildConfigMessage, targetOrigin]);

  const currentTemplate = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{cafe.name}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                piStatus === "online"
                  ? "bg-green-100 text-green-700"
                  : piStatus === "offline"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  piStatus === "online"
                    ? "bg-green-500"
                    : piStatus === "offline"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
              />
              {piStatus === "online"
                ? "Connected"
                : piStatus === "offline"
                ? "Offline"
                : "Checking..."}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Template selector */}
            {templates.length > 1 && features?.canSelectTemplate && (
              <select
                value={selectedTemplate ?? ""}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="rounded-md border px-2 py-1 text-xs outline-none"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            )}

            <div className="text-right">
              <p className="text-xs font-medium">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {user.role.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      {piStatus === "online" && piUrl ? (
        <iframe
          ref={iframeRef}
          src={`${piUrl}?cafe=${cafe.id}&embedded=true`}
          onLoad={handleIframeLoad}
          className="h-[calc(100vh-48px)] w-full border-0"
          allow="camera; microphone"
          title={`${cafe.name} Photo Booth Dashboard`}
        />
      ) : (
        <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
          {/* Offline state */}
          {piStatus === "offline" && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-yellow-800">
                Pi Server Not Reachable
              </h2>
              <p className="text-xs text-yellow-700">
                {piUrl
                  ? `Cannot reach ${piUrl}. Make sure the Raspberry Pi is powered on and connected to the same network.`
                  : "No Pi server URL configured for this cafe. Ask your admin to set one up."}
              </p>
            </div>
          )}

          {piStatus === "checking" && (
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Connecting to booth...
              </p>
            </div>
          )}

          {/* Configuration summary */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Booth Configuration</h2>

            {config && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Branding
                  </h3>
                  <div className="text-sm space-y-1">
                    <p>Header: {config.headerText || "(none)"}</p>
                    <p>Font: {config.headerTextFont}</p>
                    <p>Height: {config.headerHeight}px</p>
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-3 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Print Settings
                  </h3>
                  <div className="text-sm space-y-1">
                    <p>Style: {config.algorithm}</p>
                    <p>Brightness: {config.printBrightness}</p>
                    <p>Filter: {config.photoFilter}</p>
                    <p>Border: {config.photoBorderId}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Feature access list */}
            {features && (
              <div className="rounded-lg border bg-background p-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Features
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(features)
                    .filter(([, v]) => v === true)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {key.replace(/^can/, "").replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Templates */}
            {templates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Templates ({templates.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border p-3 space-y-1 cursor-pointer transition-colors ${
                        selectedTemplate === t.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      {t.thumbnailUrl && (
                        <img
                          src={t.thumbnailUrl}
                          alt={t.name}
                          className="w-full rounded object-cover aspect-3/4 bg-muted"
                        />
                      )}
                      <p className="text-sm font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1">
                        {t.isDefault && (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
                            Default
                          </span>
                        )}
                        {t.lockedFields.length > 0 && (
                          <span className="text-[9px] text-muted-foreground">
                            {t.lockedFields.length} locked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
