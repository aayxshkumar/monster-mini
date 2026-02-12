"use client";

import { useRef, useEffect, useState, useId, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QRCodeSVG } from "qrcode.react";
import { GripVertical, Pencil } from "lucide-react";
import { useBoothStore } from "@/store/booth-store";
import { StickersOverlay } from "@/components/stickers-overlay";
import { GRID_LAYOUTS } from "@/lib/grid-layouts";
import { loadGoogleFont } from "@/lib/fonts";

/* ── Inline editable text (click to edit, blur/Enter to save) ────── */
function InlineText({
  value,
  placeholder,
  onChange,
  className,
  style,
  multiline,
  inputClassName,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }, [draft, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  if (editing) {
    const shared = {
      ref: inputRef as React.Ref<HTMLInputElement & HTMLTextAreaElement>,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: `w-full bg-transparent outline-none ring-1 ring-blue-400/50 rounded px-1 ${inputClassName || ""}`,
      style: { ...style, resize: "none" as const, color: "black" },
      placeholder,
    };
    return multiline ? (
      <textarea {...shared} rows={2} />
    ) : (
      <input {...shared} />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={`cursor-text hover:ring-1 hover:ring-blue-400/30 rounded px-0.5 transition-all inline-block ${className || ""}`}
      style={{ ...style, color: style?.color || "black" }}
      title="Click to edit"
    >
      {value || <span style={{ color: "rgba(0,0,0,0.25)" }}>{placeholder}</span>}
    </span>
  );
}

/* ── Vertical resize handle (drag to change height) ──────────────── */
function VerticalResizeHandle({
  onResize,
  label,
}: {
  onResize: (deltaY: number) => void;
  label?: string;
}) {
  const [active, setActive] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - startYRef.current;
      startYRef.current = e.clientY;
      onResize(dy);
    };
    const onUp = () => setActive(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, onResize]);

  return (
    <div
      className="group/resize relative flex items-center justify-center"
      style={{ height: 10, cursor: "ns-resize", userSelect: "none" }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startYRef.current = e.clientY;
        setActive(true);
      }}
    >
      {/* Drag indicator line */}
      <div
        className="absolute inset-x-4 transition-colors"
        style={{
          height: 2,
          borderRadius: 1,
          background: active ? "rgba(96,165,250,0.6)" : "rgba(0,0,0,0.06)",
        }}
      />
      {/* Center dot handle */}
      <div
        className="relative z-10 rounded-full transition-all"
        style={{
          width: active ? 20 : 12,
          height: 4,
          background: active ? "rgba(96,165,250,0.8)" : "rgba(0,0,0,0.12)",
          transition: "all 0.15s",
        }}
      />
      {/* Tooltip label */}
      {label && active && (
        <span
          className="absolute -right-1 top-1/2 -translate-y-1/2 text-[7px] font-mono px-1 py-0.5 rounded whitespace-nowrap"
          style={{ color: "rgba(96,165,250,0.8)", background: "rgba(96,165,250,0.08)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ── Corner resize handle (drag to change both width & height) ───── */
function CornerResizeHandle({
  onResize,
}: {
  onResize: (dx: number, dy: number) => void;
}) {
  const [active, setActive] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      startRef.current = { x: e.clientX, y: e.clientY };
      onResize(dx, dy);
    };
    const onUp = () => setActive(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, onResize]);

  return (
    <div
      className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2 z-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
      style={{
        width: 10,
        height: 10,
        cursor: "se-resize",
        borderRadius: "50%",
        background: active ? "rgba(96,165,250,0.8)" : "white",
        border: `2px solid ${active ? "rgba(96,165,250,1)" : "rgba(120,120,120,0.5)"}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startRef.current = { x: e.clientX, y: e.clientY };
        setActive(true);
      }}
    />
  );
}

/* ── Sortable section wrapper ──────────────────────────── */
function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };
  return (
    <div ref={setNodeRef} style={style} className="group/section relative rounded-md border border-transparent hover:border-dashed hover:border-gray-300 transition-colors">
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab rounded p-0.5 opacity-0 group-hover/section:opacity-60 hover:bg-gray-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" style={{ color: "#999" }} />
      </div>
      {children}
    </div>
  );
}

/* ── Main receipt canvas ───────────────────────────────── */
export function ReceiptCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const dndId = useId();
  const store = useBoothStore();
  const {
    sectionOrder, setSectionOrder,
    logoPreview, headerHeight, setHeaderHeight,
    headerTextEnabled, headerText, headerTextFont, headerTextSize, headerTextBold, headerTextItalic, headerTextUnderline,
    setHeaderText, setHeaderTextEnabled,
    photoPreview, photoAspectRatio, photoRotation, photoMode,
    gridPhotos, gridLayout, gridCanvasMode,
    memo, memoFont, memoFontSize, memoBold, memoItalic, memoUnderline, setMemo,
    qrUrl, setQrUrl, qrSize, setQrSize, algorithm,
    stampEnabled, stampText,
    locationText, setLocationText, locationStampEnabled,
    stickers, updateSticker, removeSticker,
  } = store;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { loadGoogleFont(memoFont); }, [memoFont]);
  useEffect(() => { if (headerTextFont) loadGoogleFont(headerTextFont); }, [headerTextFont]);

  // Track if any sticker or element is being interacted with
  useEffect(() => {
    const onDown = () => setInteracting(true);
    const onUp = () => setTimeout(() => setInteracting(false), 300);
    const el = containerRef.current?.parentElement;
    if (el) {
      el.addEventListener("mousedown", onDown);
      window.addEventListener("mouseup", onUp);
      return () => {
        el.removeEventListener("mousedown", onDown);
        window.removeEventListener("mouseup", onUp);
      };
    }
  }, [mounted]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = sectionOrder.indexOf(active.id as string);
      const newIdx = sectionOrder.indexOf(over.id as string);
      setSectionOrder(arrayMove(sectionOrder, oldIdx, newIdx));
    }
  };

  const aspectStyle = (() => {
    switch (photoAspectRatio) {
      case "1:1": return { aspectRatio: "1/1" };
      case "4:3": return { aspectRatio: "4/3" };
      case "3:4": return { aspectRatio: "3/4" };
      case "4:5": return { aspectRatio: "4/5" };
      case "5:4": return { aspectRatio: "5/4" };
      case "9:16": return { aspectRatio: "9/16" };
      case "16:9": return { aspectRatio: "16/9" };
      case "2:3": return { aspectRatio: "2/3" };
      case "3:2": return { aspectRatio: "3/2" };
      default: return {};
    }
  })();

  /* For rotated photos: swap aspect when 90/270 so image fits properly */
  const rotatedAspectStyle = (() => {
    if (photoRotation === 90 || photoRotation === 270) {
      // Swap width/height ratio for the container
      switch (photoAspectRatio) {
        case "1:1": return { aspectRatio: "1/1" };
        case "4:3": return { aspectRatio: "3/4" };
        case "3:4": return { aspectRatio: "4/3" };
        case "4:5": return { aspectRatio: "5/4" };
        case "5:4": return { aspectRatio: "4/5" };
        case "9:16": return { aspectRatio: "16/9" };
        case "16:9": return { aspectRatio: "9/16" };
        case "2:3": return { aspectRatio: "3/2" };
        case "3:2": return { aspectRatio: "2/3" };
        default: return {};
      }
    }
    return aspectStyle;
  })();

  /* ── Inline-editable QR section ── */
  const [editingQr, setEditingQr] = useState(false);
  const [qrDraft, setQrDraft] = useState(qrUrl);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQrDraft(qrUrl); }, [qrUrl]);
  useEffect(() => { if (editingQr && qrInputRef.current) { qrInputRef.current.focus(); qrInputRef.current.select(); } }, [editingQr]);

  const commitQr = useCallback(() => {
    setEditingQr(false);
    if (qrDraft !== qrUrl) setQrUrl(qrDraft);
  }, [qrDraft, qrUrl, setQrUrl]);

  /* ── Resize handlers ── */
  const handleLogoResize = useCallback((dy: number) => {
    // Scale factor: preview is 280px wide / 576 actual = ~0.486
    const scale = 576 / 280;
    setHeaderHeight(Math.max(10, Math.min(200, headerHeight + dy * scale)));
  }, [headerHeight, setHeaderHeight]);

  const handleQrResize = useCallback((_dx: number, dy: number) => {
    setQrSize(Math.max(32, Math.min(120, qrSize + dy)));
  }, [qrSize, setQrSize]);

  const renderSection = (id: string) => {
    switch (id) {
      /* ── LOGO + Header text ── */
      case "logo":
        return (
          <div className="flex flex-col items-center px-6 py-1">
            <div className="flex justify-center" style={{ minHeight: headerHeight * (280 / 576) }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="max-h-full w-auto object-contain" style={{ height: headerHeight * (280 / 576) }} />
              ) : (
                <div className="flex items-center justify-center text-[10px]" style={{ height: headerHeight * (280 / 576), color: "rgba(0,0,0,0.2)" }}>
                  logo
                </div>
              )}
            </div>
            {/* Inline-editable header text */}
            {headerTextEnabled ? (
              <div className="mt-0.5 w-full text-center">
                <InlineText
                  value={headerText}
                  placeholder="header text…"
                  onChange={setHeaderText}
                  style={{
                    fontFamily: headerTextFont,
                    fontSize: `${Math.max(6, headerTextSize * (280 / 576))}px`,
                    fontWeight: headerTextBold ? "bold" : "normal",
                    fontStyle: headerTextItalic ? "italic" : "normal",
                    textDecoration: headerTextUnderline ? "underline" : "none",
                    textAlign: "center" as const,
                    color: "black",
                  }}
                  inputClassName="text-center"
                />
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setHeaderTextEnabled(true); }}
                className="mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] hover:bg-gray-100 transition-colors"
                style={{ color: "rgba(0,0,0,0.25)" }}
                title="Add header text"
              >
                <Pencil className="h-2 w-2" />
                add text
              </button>
            )}
            {/* Resize handle to change logo header height */}
            <VerticalResizeHandle onResize={handleLogoResize} label={`${Math.round(headerHeight)}px`} />
          </div>
        );

      /* ── PHOTO ── */
      case "photo":
        if (photoMode === "grid" && gridPhotos.length > 0) {
          const cells = GRID_LAYOUTS[gridLayout] || GRID_LAYOUTS["1-full"];
          return (
            <div className="relative mx-1 my-1 overflow-hidden rounded-sm" style={{ ...aspectStyle, aspectRatio: aspectStyle.aspectRatio || "4/5" }}>
              {gridCanvasMode ? (
                gridPhotos.map((p) => (
                  <FreePhoto key={p.id} photo={p} />
                ))
              ) : (
                cells.slice(0, gridPhotos.length).map((cell, i) => {
                  const p = gridPhotos[i];
                  return p ? (
                    <div key={cell.id} className="absolute overflow-hidden"
                      style={{ left: `${cell.x}%`, top: `${cell.y}%`, width: `${cell.w}%`, height: `${cell.h}%`, padding: "1px" }}>
                      <img src={p.preview} alt="" className="h-full w-full rounded-[2px] object-cover" />
                    </div>
                  ) : null;
                })
              )}
            </div>
          );
        }
        return (
          <div className="px-1 py-1">
            {photoPreview ? (
              <div className="overflow-hidden rounded-sm" style={rotatedAspectStyle}>
                <img
                  src={photoPreview}
                  alt="Photo"
                  className="object-cover"
                  style={{
                    transform: `rotate(${photoRotation}deg)`,
                    /* Scale up to fill the container after rotation */
                    width: (photoRotation === 90 || photoRotation === 270) ? "auto" : "100%",
                    height: (photoRotation === 90 || photoRotation === 270) ? "100%" : "auto",
                    minWidth: "100%",
                    minHeight: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-sm" style={{
                ...(aspectStyle.aspectRatio ? aspectStyle : { aspectRatio: "4/5" }),
                backgroundColor: "rgba(0,0,0,0.03)",
              }}>
                <div className="text-center" style={{ color: "rgba(0,0,0,0.25)" }}>
                  <svg className="mx-auto h-8 w-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-[9px]">photo</p>
                </div>
              </div>
            )}
          </div>
        );

      /* ── MEMO (inline editable) ── */
      case "memo":
        return (
          <div className="px-4 py-2 text-center">
            <InlineText
              value={memo}
              placeholder={"\u201Cmemo\u201D"}
              onChange={setMemo}
              multiline
              style={{
                fontFamily: memoFont,
                fontSize: `${Math.max(8, memoFontSize * (280 / 576))}px`,
                fontWeight: memoBold ? "bold" : "normal",
                fontStyle: memoItalic ? "italic" : "normal",
                textDecoration: memoUnderline ? "underline" : "none",
                textAlign: "center" as const,
                color: "rgba(0,0,0,0.8)",
              }}
              className="leading-relaxed"
              inputClassName="text-center"
            />
          </div>
        );

      /* ── QR (inline editable URL + resizable) ── */
      case "qr":
        return (
          <div className="relative flex flex-col items-center px-4 pb-1">
            <div
              className="cursor-pointer group/qr relative"
              onClick={(e) => { e.stopPropagation(); setEditingQr(true); }}
              title="Click to edit QR URL"
            >
              <QRCodeSVG value={qrUrl || "https://youmee.app"} size={qrSize} level="M" bgColor="transparent" />
              <div className="absolute inset-0 flex items-center justify-center rounded transition-colors" style={{ background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Pencil className="h-3 w-3 opacity-0 group-hover/qr:opacity-70 transition-opacity" style={{ color: "#666", filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.8))" }} />
              </div>
            </div>
            {/* Corner resize handle for QR */}
            <CornerResizeHandle onResize={handleQrResize} />
            {editingQr ? (
              <input
                ref={qrInputRef}
                value={qrDraft}
                onChange={(e) => setQrDraft(e.target.value)}
                onBlur={commitQr}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitQr(); }
                  if (e.key === "Escape") { setQrDraft(qrUrl); setEditingQr(false); }
                }}
                className="mt-1 w-full bg-transparent text-center text-[8px] font-mono outline-none ring-1 ring-blue-400/50 rounded px-1 py-0.5"
                style={{ color: "black" }}
                placeholder="https://youmee.app"
              />
            ) : (
              <p
                className="mt-0.5 text-[7px] uppercase tracking-wide cursor-pointer transition-colors"
                style={{ color: "rgba(0,0,0,0.3)" }}
                onClick={(e) => { e.stopPropagation(); setEditingQr(true); }}
              >
                scan for digital copy
              </p>
            )}
          </div>
        );

      /* ── STAMP (inline editable location text) ── */
      case "stamp":
        if (!stampEnabled) return null;
        return (
          <div className="px-4 py-1 text-center">
            {locationStampEnabled ? (
              <div className="flex items-center justify-center gap-1">
                <span className="text-[8px] font-mono tracking-wide whitespace-nowrap" style={{ color: "rgba(0,0,0,0.45)" }}>
                  {stampText.split("·").slice(0, -1).join("·")}{stampText.includes("·") ? "· " : ""}
                </span>
                <InlineText
                  value={locationText}
                  placeholder="location…"
                  onChange={setLocationText}
                  style={{ fontSize: "8px", color: "rgba(0,0,0,0.45)" }}
                  className="font-mono tracking-wide"
                  inputClassName="text-[8px] font-mono text-center"
                />
              </div>
            ) : (
              <p className="text-[8px] font-mono tracking-wide" style={{ color: "rgba(0,0,0,0.45)" }}>
                {stampText || "date / time"}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const content = (
    <>
      {sectionOrder.map((id) => {
        const section = renderSection(id);
        if (!section) return null;
        return (
          <SortableSection key={id} id={id}>
            {section}
            <div className="mx-3" style={{ borderBottom: "1px dotted rgba(0,0,0,0.08)" }} />
          </SortableSection>
        );
      })}
    </>
  );

  return (
    <div className="flex flex-col items-center">
      {/* Outer wrapper with bleed zone — stickers can extend into this area */}
      <div
        className="relative"
        style={{
          padding: "20px",
          /* When interacting, show the printable area boundary */
          transition: "box-shadow 0.2s, padding 0.2s",
        }}
      >
        {/* Bleed zone indicator — shows dotted border when interacting */}
        {interacting && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              border: "2px dashed rgba(96,165,250,0.35)",
              background: "rgba(96,165,250,0.03)",
            }}
          >
            <span
              className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: "rgba(96,165,250,0.6)", background: "rgba(96,165,250,0.08)" }}
            >
              bleed area
            </span>
          </div>
        )}

        {/* The actual receipt paper */}
        <div
          className="receipt-paper relative w-[280px] overflow-visible rounded-sm pl-6"
          ref={containerRef}
          style={{
            /* Highlight printable area when interacting */
            boxShadow: interacting
              ? "0 0 0 2px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.12), 0 8px 40px rgba(0,0,0,0.06)"
              : "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)",
            transition: "box-shadow 0.2s",
          }}
        >
          {/* Print area indicator when interacting */}
          {interacting && (
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <span
                className="text-[8px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: "rgba(0,0,0,0.5)", background: "rgba(0,0,0,0.06)" }}
              >
                ✂ printable area
              </span>
            </div>
          )}

          {/* Top torn edge */}
          <div className="h-2" style={{ background: "linear-gradient(to bottom, rgba(200,200,200,0.3), white)" }} />

          {mounted ? (
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                {content}
              </SortableContext>
            </DndContext>
          ) : (
            <div>{sectionOrder.map((id) => <div key={id}>{renderSection(id)}</div>)}</div>
          )}

          {/* Algorithm badge */}
          <div className="flex justify-center py-2">
            <span className="rounded-full px-2 py-0.5 text-[6px] uppercase tracking-widest" style={{ background: "#f0f0f0", color: "rgba(0,0,0,0.35)" }}>
              {algorithm}
            </span>
          </div>

          {/* Bottom torn edge */}
          <div className="h-3" style={{ background: "linear-gradient(to top, rgba(200,200,200,0.3), white)" }} />

          {/* Sticker overlay — contained within the receipt + bleed area */}
          <StickersOverlay
            stickers={stickers}
            onUpdate={updateSticker}
            onRemove={removeSticker}
            containerRef={containerRef}
          />
        </div>
      </div>
    </div>
  );
}

/** Freely draggable + resizable image in canvas mode */
function FreePhoto({ photo }: { photo: { id: string; preview: string; x?: number; y?: number; w?: number; h?: number } }) {
  const updatePos = useBoothStore((s) => s.updateGridPhotoPos);
  const removePhoto = useBoothStore((s) => s.removeGridPhoto);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0, ow: 0, oh: 0 });

  const x = photo.x ?? 10;
  const y = photo.y ?? 10;
  const w = photo.w ?? 55;
  const h = photo.h ?? 55;

  const pxToPercX = 100 / 270;
  const pxToPercY = 100 / 340;

  const onDragDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    startRef.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y, ow: w, oh: h };
  };

  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    startRef.current = { mx: e.clientX, my: e.clientY, ox: x, oy: y, ow: w, oh: h };
  };

  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.mx;
      const dy = e.clientY - startRef.current.my;
      if (dragging) {
        updatePos(photo.id, {
          x: Math.max(0, Math.min(90, startRef.current.ox + dx * pxToPercX)),
          y: Math.max(0, Math.min(90, startRef.current.oy + dy * pxToPercY)),
        });
      } else if (resizing) {
        updatePos(photo.id, {
          w: Math.max(15, Math.min(100, startRef.current.ow + dx * pxToPercX)),
          h: Math.max(15, Math.min(100, startRef.current.oh + dy * pxToPercY)),
        });
      }
    };
    const onUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, resizing, photo.id, updatePos]);

  return (
    <div
      className="group absolute rounded-sm overflow-visible"
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
    >
      {/* Drag area */}
      <div
        className="h-full w-full cursor-grab active:cursor-grabbing overflow-hidden rounded-sm ring-1 ring-transparent group-hover:ring-blue-400/50"
        onMouseDown={onDragDown}
      >
        <img src={photo.preview} alt="" className="h-full w-full object-cover pointer-events-none" draggable={false} />
      </div>

      {/* Delete button — top-right corner */}
      <button
        onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
        className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 z-10 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "rgba(0,0,0,0.8)", color: "white" }}
      >
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/2 z-10 h-3 w-3 cursor-se-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 shadow-sm"
        style={{ background: "white", border: "2px solid rgba(96,165,250,0.6)" }}
        onMouseDown={onResizeDown}
      />

      {/* Selection border */}
      <div className="absolute inset-0 rounded-sm border border-transparent group-hover:border-blue-400/40 pointer-events-none" />
    </div>
  );
}
