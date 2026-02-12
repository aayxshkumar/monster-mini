"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PrintButtonProps {
  disabled: boolean;
  onPrint: () => void;
}

export function PrintButton({ disabled, onPrint }: PrintButtonProps) {
  const handlePrint = () => {
    onPrint();
    toast.success("Print job queued", {
      description: "Your receipt is being prepared.",
      duration: 3000,
    });
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePrint}
        disabled={disabled}
        className="w-full h-12 text-base font-semibold tracking-wide gradient-warm text-white hover:opacity-90"
        size="lg"
      >
        <Printer className="mr-2 h-5 w-5" />
        Print Receipt
      </Button>
      {disabled && (
        <p className="text-center text-xs text-muted-foreground">
          Add a photo to enable printing
        </p>
      )}
    </div>
  );
}
