"use client";

import { DELIVERY_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

type CapsulePreviewProps = {
  message: string;
  photoImageUrl: string | null;
  deliveryOption: string;
  customDate: string;
  includeTemplate?: boolean;
  onClose: () => void;
};

export function CapsulePreview({
  message,
  photoImageUrl,
  deliveryOption,
  customDate,
  includeTemplate,
  onClose,
}: CapsulePreviewProps) {
  const opt = DELIVERY_OPTIONS[deliveryOption as keyof typeof DELIVERY_OPTIONS];
  const deliveryLabel =
    deliveryOption === "custom" && customDate
      ? new Date(customDate).toLocaleDateString()
      : opt?.label ?? deliveryOption;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-lg mb-4">Email preview</h3>
        <div className="space-y-4 text-sm border rounded-lg p-4 bg-[var(--muted-foreground)]/5">
          {photoImageUrl && (
            <img
              src={photoImageUrl}
              alt="Preview"
              className="w-full rounded object-contain max-h-48"
            />
          )}
          <p className="whitespace-pre-wrap">{message || "(Your message)"}</p>
          <p className="text-muted-foreground">
            Delivered: {deliveryLabel}
          </p>
          {includeTemplate && (
            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded px-2 py-1">
              Event template will be applied to the email design
            </p>
          )}
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
