"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon, X, Pencil } from "lucide-react";
import { CropDialog } from "@/components/crop-dialog";

interface ImageDropzoneProps {
  label: string;
  hint: string;
  /** Current (possibly cropped) preview URL */
  value: string | null;
  /** Original (uncropped) preview URL — CropDialog always uses this */
  originalValue?: string | null;
  onDrop: (file: File) => void;
  onClear: () => void;
  onCropped?: (blob: Blob, url: string) => void;
  /** Called when "Reset to original" is clicked inside CropDialog */
  onReset?: () => void;
  compact?: boolean;
  aspect?: number;
}

export function ImageDropzone({
  label,
  hint,
  value,
  originalValue,
  onDrop,
  onClear,
  onCropped,
  onReset,
  compact,
  aspect,
}: ImageDropzoneProps) {
  const [cropOpen, setCropOpen] = useState(false);

  const handleDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onDrop(accepted[0]);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    multiple: false,
  });

  const cropSource = originalValue || value;
  const isCropped = !!(originalValue && value && originalValue !== value);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div
        {...getRootProps()}
        className={`
          relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200
          ${isDragActive
            ? "dropzone-active"
            : value
              ? "border-transparent bg-muted/30 hover:bg-muted/50"
              : "border-muted-foreground/20 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/40"
          }
          ${compact ? "p-3" : "p-4"}
        `}
      >
        <input {...getInputProps()} />

        {value ? (
          <div className="relative">
            <img
              src={value}
              alt={label}
              className={`w-full rounded-lg object-contain ${compact ? "max-h-16" : "max-h-44"}`}
            />
            {/* Edit / Crop */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCropOpen(true);
              }}
              className="absolute -top-2 -left-2 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {/* Clear */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute -top-2 -right-2 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-2 text-muted-foreground ${compact ? "py-2" : "py-6"}`}>
            {compact ? (
              <ImageIcon className="h-5 w-5" />
            ) : (
              <div className="rounded-full bg-muted p-3">
                <Upload className="h-5 w-5" />
              </div>
            )}
            <div className="text-center">
              <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>
                {isDragActive ? "Drop it here" : "Drag & drop"}
              </p>
              <p className="text-xs text-muted-foreground/70">{hint}</p>
            </div>
          </div>
        )}
      </div>

      {cropSource && (
        <CropDialog
          open={cropOpen}
          onOpenChange={setCropOpen}
          imageSrc={cropSource}
          aspect={aspect}
          isCropped={isCropped}
          onCropComplete={(blob, url) => {
            if (onCropped) onCropped(blob, url);
          }}
          onReset={onReset}
        />
      )}
    </div>
  );
}
