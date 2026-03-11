"use client";

import { DELIVERY_OPTIONS } from "@/lib/constants";

type DeliveryPickerProps = {
  value: string;
  onChange: (value: keyof typeof DELIVERY_OPTIONS) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
};

export function DeliveryPicker({
  value,
  onChange,
  customDate,
  onCustomDateChange,
}: DeliveryPickerProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">When should we deliver?</label>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(DELIVERY_OPTIONS) as [keyof typeof DELIVERY_OPTIONS, { label: string }][]).map(
          ([opt, { label }]) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-md px-3 py-1.5 text-sm border ${
                value === opt
                  ? "bg-foreground text-background border-foreground"
                  : "border-[var(--muted-foreground)]/30 hover:bg-[var(--muted-foreground)]/10"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>
      {value === "custom" && onCustomDateChange && (
        <input
          type="date"
          value={customDate ?? ""}
          onChange={(e) => onCustomDateChange(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          max={(() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().slice(0, 10);
          })()}
          className="mt-2 w-full rounded-md border border-[var(--muted-foreground)]/30 bg-background px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}
