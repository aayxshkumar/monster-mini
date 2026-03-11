"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { cafeTemplates } from "@/lib/schema";

type Template = InferSelectModel<typeof cafeTemplates>;

interface Props {
  cafeId: string;
  templates: Template[];
  dashboardUrl: string;
}

const LOCKABLE_FIELDS = [
  { key: "headerText", label: "Header Text" },
  { key: "headerTextFont", label: "Header Font" },
  { key: "headerTextSize", label: "Header Font Size" },
  { key: "headerHeight", label: "Header Height" },
  { key: "memo", label: "Memo Text" },
  { key: "memoFont", label: "Memo Font" },
  { key: "memoFontSize", label: "Memo Font Size" },
  { key: "photoFilter", label: "Photo Filter" },
  { key: "photoBorderId", label: "Photo Border" },
  { key: "photoAspectRatio", label: "Photo Aspect Ratio" },
  { key: "algorithm", label: "Dithering Algorithm" },
  { key: "printBrightness", label: "Print Brightness" },
  { key: "qrEnabled", label: "QR Code Toggle" },
  { key: "qrUrl", label: "QR URL" },
  { key: "qrCaption", label: "QR Caption" },
  { key: "dateStampEnabled", label: "Date Stamp" },
  { key: "timeStampEnabled", label: "Time Stamp" },
  { key: "locationStampEnabled", label: "Location Stamp" },
  { key: "locationText", label: "Location Text" },
  { key: "sectionOrder", label: "Section Order" },
  { key: "printCopies", label: "Print Copies" },
];

export function TemplateManager({ cafeId, templates: initial, dashboardUrl }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDialogData, setSaveDialogData] = useState<{ state: string; thumbnail: string | null } | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [editingLockId, setEditingLockId] = useState<string | null>(null);
  const [editLockFields, setEditLockFields] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for postMessage from dashboard iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "archivio:save-template") {
        const { state, thumbnail } = event.data.payload;
        setSaveDialogData({ state, thumbnail });
        setTemplateName("");
        setTemplateDesc("");
        setLockedFields([]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleCreateTemplate = useCallback(async () => {
    if (!saveDialogData || !templateName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId,
          name: templateName.trim(),
          description: templateDesc.trim(),
          state: saveDialogData.state,
          thumbnailUrl: saveDialogData.thumbnail,
          lockedFields,
        }),
      });
      if (!res.ok) throw new Error("Failed to create template");
      const { id } = await res.json();

      setTemplates((prev) => [
        ...prev,
        {
          id,
          cafeId,
          name: templateName.trim(),
          description: templateDesc.trim(),
          thumbnailUrl: saveDialogData.thumbnail,
          state: saveDialogData.state,
          lockedFields: JSON.stringify(lockedFields),
          isDefault: false,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      setSaveDialogData(null);
      setDesignerOpen(false);
    } finally {
      setSaving(false);
    }
  }, [saveDialogData, templateName, templateDesc, lockedFields, cafeId]);

  const handleSetDefault = useCallback(async (id: string) => {
    await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setTemplates((prev) =>
      prev.map((t) => ({ ...t, isDefault: t.id === id })),
    );
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSaveLockFields = useCallback(async () => {
    if (!editingLockId) return;
    await fetch(`/api/templates/${editingLockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockedFields: editLockFields }),
    });
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingLockId ? { ...t, lockedFields: JSON.stringify(editLockFields), updatedAt: Date.now() } : t,
      ),
    );
    setEditingLockId(null);
  }, [editingLockId, editLockFields]);

  const toggleLockField = (field: string) => {
    setLockedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const toggleEditLockField = (field: string) => {
    setEditLockFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Templates
        </h2>
        <button
          onClick={() => setDesignerOpen(true)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Design Template
        </button>
      </div>

      {/* Template grid */}
      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No templates yet. Click &ldquo;Design Template&rdquo; to create one using the dashboard.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const locked: string[] = JSON.parse(t.lockedFields ?? "[]");
            return (
              <div key={t.id} className="rounded-lg border bg-background p-3 space-y-2">
                {t.thumbnailUrl && (
                  <img
                    src={t.thumbnailUrl}
                    alt={t.name}
                    className="w-full rounded-md object-cover aspect-3/4 bg-muted"
                  />
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.isDefault && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                      Default
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {locked.length} locked field{locked.length !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-1.5 pt-1">
                  {!t.isDefault && (
                    <button
                      onClick={() => handleSetDefault(t.id)}
                      className="rounded px-2 py-1 text-[10px] border hover:bg-muted transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingLockId(t.id);
                      setEditLockFields(locked);
                    }}
                    className="rounded px-2 py-1 text-[10px] border hover:bg-muted transition-colors"
                  >
                    Lock Fields
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded px-2 py-1 text-[10px] border text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Design Template iframe overlay */}
      {designerOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
            <h3 className="font-semibold text-sm">Design Template</h3>
            <div className="flex gap-2">
              <span className="text-xs text-muted-foreground self-center">
                Click &ldquo;Save Template&rdquo; in the dashboard toolbar when done
              </span>
              <button
                onClick={() => setDesignerOpen(false)}
                className="rounded-md border px-3 py-1 text-xs hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={`${dashboardUrl}?mode=design&embedded=true`}
            className="flex-1 w-full border-0"
            allow="camera; microphone"
            title="Template Designer"
          />
        </div>
      )}

      {/* Save template dialog */}
      {saveDialogData && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold">Save Template</h3>

            {saveDialogData.thumbnail && (
              <img
                src={saveDialogData.thumbnail}
                alt="Template preview"
                className="mx-auto h-48 object-contain rounded-lg border bg-muted"
              />
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Template Name *</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Classic Receipt"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Locked Fields (operators cannot change these)
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {LOCKABLE_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockedFields.includes(f.key)}
                      onChange={() => toggleLockField(f.key)}
                      className="rounded"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveDialogData(null)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!templateName.trim() || saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit locked fields dialog */}
      {editingLockId && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border shadow-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit Locked Fields</h3>
            <p className="text-xs text-muted-foreground">
              Operators will not be able to modify locked fields when using this template.
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {LOCKABLE_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editLockFields.includes(f.key)}
                    onChange={() => toggleEditLockField(f.key)}
                    className="rounded"
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingLockId(null)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLockFields}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
