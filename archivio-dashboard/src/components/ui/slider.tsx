"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
};

/**
 * Single-thumb slider built on native range input to avoid Radix controlled-mode update loops.
 * Accepts value=[number] and onValueChange={([v]) => setValue(v)} for compatibility with existing usage.
 */
function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  ...props
}: SliderProps) {
  const numValue = Array.isArray(value) ? value[0] : Array.isArray(defaultValue) ? defaultValue[0] : min;
  const [internalValue, setInternalValue] = React.useState(numValue);
  const isControlled = Array.isArray(value);
  const current = isControlled ? value[0] : internalValue;

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (!isControlled) setInternalValue(v);
      onValueChange?.([v]);
    },
    [isControlled, onValueChange]
  );

  React.useEffect(() => {
    if (isControlled && value?.[0] !== undefined) setInternalValue(value[0]);
  }, [isControlled, value?.[0]]);

  return (
    <div
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "h-1.5 w-full grow cursor-pointer appearance-none rounded-full bg-muted [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary",
          "[&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary",
          "[&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-pointer"
        )}
        {...props}
      />
    </div>
  );
}

export { Slider };
