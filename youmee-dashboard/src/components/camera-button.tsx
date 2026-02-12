"use client";

import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface CameraButtonProps {
  onCapture: (url: string, filename: string) => void;
  cameraAvailable: boolean;
}

export function CameraButton({ onCapture, cameraAvailable }: CameraButtonProps) {
  const [capturing, setCapturing] = useState(false);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await api.capturePhoto();
      onCapture(api.imageUrl(result.filename), result.filename);
    } catch (err) {
      console.error("Camera capture failed:", err);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCapture}
      disabled={!cameraAvailable || capturing}
      className="w-full gap-2 border-dashed"
    >
      {capturing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Camera className="h-4 w-4" />
      )}
      {capturing
        ? "Capturing..."
        : cameraAvailable
          ? "Take photo from Pi camera"
          : "Pi camera not detected"
      }
    </Button>
  );
}
