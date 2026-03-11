"use client";

import { useState } from "react";
import type { CafeFeatureFlags } from "@/types";
import { toast } from "sonner";

interface Props {
  cafeId: string;
  piServerUrl?: string | null;
  config: {
    features: CafeFeatureFlags;
    sectionOrder: string[];
    headerText?: string | null;
    headerTextFont?: string | null;
    headerTextSize?: number | null;
    headerHeight?: number | null;
    algorithm?: string | null;
    printBrightness?: string | null;
    photoBorderId?: string | null;
    photoFilter?: string | null;
    [key: string]: unknown;
  };
}

// Feature flag definitions for the UI
const FEATURE_GROUPS = [
  {
    label: "Photo Controls",
    flags: [
      { key: "canUploadPhoto", label: "Upload photos" },
      { key: "canUseCamera", label: "Use Pi camera" },
      { key: "canUseMultiCapture", label: "Multi-capture mode" },
      { key: "canUseGridMode", label: "Grid/collage mode" },
      { key: "canChangeFilter", label: "Change photo filter" },
      { key: "canChangeBorder", label: "Change photo border" },
      { key: "canChangeAspectRatio", label: "Change aspect ratio" },
      { key: "canRotatePhoto", label: "Rotate photo" },
    ],
  },
  {
    label: "Stickers & Text",
    flags: [
      { key: "canUseStickers", label: "Use stickers" },
      { key: "canUploadStickers", label: "Upload custom stickers" },
      { key: "canEditMemo", label: "Edit memo text" },
      { key: "canEditHeaderText", label: "Edit header text" },
      { key: "canChangeFont", label: "Change fonts" },
    ],
  },
  {
    label: "Print & Output",
    flags: [
      { key: "canChangePrintStyle", label: "Change print style (dithering)" },
      { key: "canChangeBrightness", label: "Change brightness" },
      { key: "canChangeCopies", label: "Change copy count" },
      { key: "canEditQr", label: "Edit QR code" },
      { key: "canEditStamps", label: "Edit date/time stamps" },
      { key: "canReorderSections", label: "Reorder sections" },
    ],
  },
  {
    label: "Sharing & Templates",
    flags: [
      { key: "canShareDigital", label: "Share digital copy" },
      { key: "canDownloadImage", label: "Download image" },
      { key: "canSelectTemplate", label: "Select templates" },
      { key: "canCreateTemplate", label: "Create new templates" },
    ],
  },
] as const;

const ALGORITHMS = [
  { value: "atkinson", label: "Film Grain" },
  { value: "floyd_steinberg", label: "Fine Detail" },
  { value: "stucki", label: "High Quality" },
  { value: "bayer8", label: "Newspaper" },
];

const BRIGHTNESS_PRESETS = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const FILTERS = [
  { value: "none", label: "Standard B&W" },
  { value: "sepia", label: "Warm Sepia" },
];

const BORDERS = [
  { value: "none", label: "None" },
  { value: "thin", label: "Thin" },
  { value: "medium", label: "Medium" },
  { value: "thick", label: "Thick" },
  { value: "rounded", label: "Rounded" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "polaroid", label: "Polaroid" },
  { value: "vintage", label: "Vintage" },
  { value: "double", label: "Double" },
];

export function CafeConfigEditor({ cafeId, piServerUrl, config }: Props) {
  const [features, setFeatures] = useState<CafeFeatureFlags>(config.features);
  const [branding, setBranding] = useState({
    headerText: config.headerText ?? "",
    headerTextFont: config.headerTextFont ?? "Inter",
    headerTextSize: config.headerTextSize ?? 12,
    headerHeight: config.headerHeight ?? 64,
  });
  const [print, setPrint] = useState({
    algorithm: config.algorithm ?? "atkinson",
    printBrightness: config.printBrightness ?? "medium",
    photoBorderId: config.photoBorderId ?? "none",
    photoFilter: config.photoFilter ?? "none",
  });
  const [event, setEvent] = useState({
    eventModeEnabled: (config.eventModeEnabled as boolean) ?? false,
    eventName: (config.eventName as string) ?? "",
    eventDate: (config.eventDate as string) ?? "",
    eventLocation: (config.eventLocation as string) ?? "",
  });
  const [qr, setQr] = useState({
    qrEnabled: (config.qrEnabled as boolean) ?? true,
    qrUrl: (config.qrUrl as string) ?? "",
    qrCaption: (config.qrCaption as string) ?? "",
  });
  const [stamps, setStamps] = useState({
    dateStampEnabled: (config.dateStampEnabled as boolean) ?? false,
    timeStampEnabled: (config.timeStampEnabled as boolean) ?? false,
    locationStampEnabled: (config.locationStampEnabled as boolean) ?? false,
    locationText: (config.locationText as string) ?? "",
  });
  const [memo, setMemo] = useState({
    defaultMemo: (config.defaultMemo as string) ?? "",
    memoFont: (config.memoFont as string) ?? "Inter",
    memoFontSize: (config.memoFontSize as number) ?? 10,
  });
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    config.sectionOrder?.length ? config.sectionOrder : ["logo", "photo", "memo", "qr", "stamp"],
  );
  const [saving, setSaving] = useState(false);

  const toggleFeature = (key: string) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key as keyof CafeFeatureFlags] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/config/${cafeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...branding,
          ...print,
          ...event,
          ...qr,
          ...stamps,
          ...memo,
          sectionOrder,
          features,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      if (piServerUrl) {
        try {
          await fetch(`${piServerUrl}/api/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cafeId, ...branding, ...print, ...event, ...qr, ...stamps, ...memo, sectionOrder, features }),
          });
        } catch {
          toast.info("Config saved, but could not sync to Pi (is it online?)");
        }
      }
      toast.success("Config saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Branding Section */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Branding & Layout
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="cfg-header-text" className="text-xs text-muted-foreground">Header text</label>
            <input
              id="cfg-header-text"
              value={branding.headerText}
              onChange={(e) => setBranding((p) => ({ ...p, headerText: e.target.value }))}
              placeholder="Cafe name or tagline"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cfg-font" className="text-xs text-muted-foreground">Font</label>
            <input
              id="cfg-font"
              value={branding.headerTextFont}
              onChange={(e) => setBranding((p) => ({ ...p, headerTextFont: e.target.value }))}
              placeholder="Inter"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cfg-text-size" className="text-xs text-muted-foreground">Text size</label>
            <input
              id="cfg-text-size"
              type="number"
              value={branding.headerTextSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!isNaN(n)) setBranding((p) => ({ ...p, headerTextSize: Math.max(8, Math.min(36, n)) }));
              }}
              min={8}
              max={36}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cfg-header-height" className="text-xs text-muted-foreground">Header height</label>
            <input
              id="cfg-header-height"
              type="number"
              value={branding.headerHeight}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!isNaN(n)) setBranding((p) => ({ ...p, headerHeight: Math.max(10, Math.min(200, n)) }));
              }}
              min={10}
              max={200}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </section>

      {/* Print Settings */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Print Settings (Defaults)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Print style</label>
            <select
              value={print.algorithm}
              onChange={(e) => setPrint((p) => ({ ...p, algorithm: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ALGORITHMS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Brightness</label>
            <select
              value={print.printBrightness}
              onChange={(e) => setPrint((p) => ({ ...p, printBrightness: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {BRIGHTNESS_PRESETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Default filter</label>
            <select
              value={print.photoFilter}
              onChange={(e) => setPrint((p) => ({ ...p, photoFilter: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Default border</label>
            <select
              value={print.photoBorderId}
              onChange={(e) => setPrint((p) => ({ ...p, photoBorderId: e.target.value }))}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {BORDERS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Feature Flags */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Feature Access
        </h2>
        <p className="text-xs text-muted-foreground">
          Control which features cafe operators can access. Disabled features are hidden from the operator dashboard.
        </p>
        <div className="space-y-6">
          {FEATURE_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-xs font-medium text-foreground">
                {group.label}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.flags.map((flag) => {
                  const key = flag.key as keyof CafeFeatureFlags;
                  const val = features[key];
                  if (typeof val !== "boolean") return null;
                  return (
                    <div key={key} className="flex items-center gap-2 group">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={val}
                        aria-label={flag.label}
                        onClick={() => toggleFeature(key)}
                        className={`flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          val ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                            val ? "translate-x-3" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground">
                        {flag.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-foreground">Copy Limit</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="cfg-max-copies" className="text-xs text-muted-foreground">Max copies:</label>
              <input
                id="cfg-max-copies"
                type="number"
                value={features.maxCopies}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!isNaN(n)) {
                    setFeatures((prev) => ({
                      ...prev,
                      maxCopies: Math.max(1, Math.min(10, n)),
                    }));
                  }
                }}
                min={1}
                max={10}
                className="w-16 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Event Mode */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Event Mode
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={event.eventModeEnabled}
            onClick={() => setEvent((p) => ({ ...p, eventModeEnabled: !p.eventModeEnabled }))}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              event.eventModeEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                event.eventModeEnabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enable event mode to stamp event details on receipts and link photos to a shared event in the share service.
        </p>
        {event.eventModeEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="cfg-event-name" className="text-xs text-muted-foreground">Event name *</label>
              <input
                id="cfg-event-name"
                value={event.eventName}
                onChange={(e) => setEvent((p) => ({ ...p, eventName: e.target.value }))}
                placeholder="e.g. Summer Pop-up 2026"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cfg-event-date" className="text-xs text-muted-foreground">Event date</label>
              <input
                id="cfg-event-date"
                type="date"
                value={event.eventDate}
                onChange={(e) => setEvent((p) => ({ ...p, eventDate: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cfg-event-location" className="text-xs text-muted-foreground">Location</label>
              <input
                id="cfg-event-location"
                value={event.eventLocation}
                onChange={(e) => setEvent((p) => ({ ...p, eventLocation: e.target.value }))}
                placeholder="e.g. Cafe Maru, Seoul"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </section>

      {/* QR Code Settings */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            QR Code
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={qr.qrEnabled}
            onClick={() => setQr((p) => ({ ...p, qrEnabled: !p.qrEnabled }))}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors cursor-pointer ${
              qr.qrEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${qr.qrEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
        {qr.qrEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">QR URL (leave empty for auto Archivio Share)</label>
              <input
                value={qr.qrUrl}
                onChange={(e) => setQr((p) => ({ ...p, qrUrl: e.target.value }))}
                placeholder="Auto (archivio-share)"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">QR caption</label>
              <input
                value={qr.qrCaption}
                onChange={(e) => setQr((p) => ({ ...p, qrCaption: e.target.value }))}
                placeholder="Scan to save your photo"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </section>

      {/* Stamps */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Stamps
        </h2>
        <p className="text-xs text-muted-foreground">Date, time, and location stamps printed on receipts.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { key: "dateStampEnabled" as const, label: "Date stamp" },
            { key: "timeStampEnabled" as const, label: "Time stamp" },
            { key: "locationStampEnabled" as const, label: "Location stamp" },
          ]).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={stamps[key]}
                onClick={() => setStamps((p) => ({ ...p, [key]: !p[key] }))}
                className={`flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors cursor-pointer ${
                  stamps[key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${stamps[key] ? "translate-x-3" : "translate-x-0"}`} />
              </button>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        {stamps.locationStampEnabled && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Location text</label>
            <input
              value={stamps.locationText}
              onChange={(e) => setStamps((p) => ({ ...p, locationText: e.target.value }))}
              placeholder="e.g. Cafe Maru, Seoul"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </section>

      {/* Memo Defaults */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Memo Defaults
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Default memo text</label>
            <textarea
              value={memo.defaultMemo}
              onChange={(e) => setMemo((p) => ({ ...p, defaultMemo: e.target.value }))}
              placeholder="A default message for receipts..."
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Memo font</label>
            <input
              value={memo.memoFont}
              onChange={(e) => setMemo((p) => ({ ...p, memoFont: e.target.value }))}
              placeholder="Inter"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Memo font size</label>
            <input
              type="number"
              value={memo.memoFontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!isNaN(n)) setMemo((p) => ({ ...p, memoFontSize: Math.max(6, Math.min(24, n)) }));
              }}
              min={6}
              max={24}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </section>

      {/* Section Order */}
      <section className="rounded-lg border bg-background p-4 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Section Order
        </h2>
        <p className="text-xs text-muted-foreground">Order of sections on the printed receipt. Use arrows to reorder.</p>
        <div className="space-y-1">
          {sectionOrder.map((section, idx) => (
            <div key={section} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-sm font-medium capitalize flex-1">{section}</span>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => {
                  const next = [...sectionOrder];
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  setSectionOrder(next);
                }}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
              >
                &#9650;
              </button>
              <button
                type="button"
                disabled={idx === sectionOrder.length - 1}
                onClick={() => {
                  const next = [...sectionOrder];
                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                  setSectionOrder(next);
                }}
                className="text-xs px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
              >
                &#9660;
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
