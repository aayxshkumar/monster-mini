"use client";

import { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintButtonProps {
  disabled: boolean;
  onPrint: () => void;
}

export function PrintButton({ disabled, onPrint }: PrintButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onPrint();
    } finally {
      // Keep loading for a bit to show feedback
      setTimeout(() => setLoading(false), 1000);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full h-12 text-base font-bold tracking-wide gradient-warm text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] rounded-lg"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <Printer className="mr-2 h-5 w-5" />
            Print Receipt
          </>
        )}
      </Button>
      {disabled && (
        <p className="text-center text-xs text-muted-foreground">
          Add a photo to enable printing
        </p>
      )}
    </div>
  );
}
