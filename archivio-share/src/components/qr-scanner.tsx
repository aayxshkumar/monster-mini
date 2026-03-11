"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, ScanLine, Loader2 } from "lucide-react";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onResult: (url: string) => void;
}

export function QrScanner({ open, onClose, onResult }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const hasResult = useRef(false);

  const stop = useCallback(async () => {
    try {
      const s = scannerRef.current;
      if (s?.isScanning) await s.stop();
      s?.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    hasResult.current = false;
    setError(null);
    setStarting(true);

    const id = "archivio-qr-reader";
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (hasResult.current) return;
          hasResult.current = true;
          stop().then(() => onResult(decoded));
        },
        () => {
          /* ignore scan failures */
        },
      )
      .then(() => setStarting(false))
      .catch((err) => {
        setStarting(false);
        const msg = typeof err === "string" ? err : err?.message ?? "Camera access denied";
        if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access and try again.");
        } else {
          setError(msg);
        }
      });

    return () => {
      stop();
    };
  }, [open, onResult, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Scan receipt QR
            </span>
          </div>
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scanner viewport */}
        <div className="relative aspect-square w-full bg-black" ref={containerRef}>
          <div id="archivio-qr-reader" className="h-full w-full" />

          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-white/70">Starting camera…</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => {
                  stop();
                  onClose();
                }}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            Point your camera at the QR code on your receipt
          </p>
        </div>
      </div>
    </div>
  );
}
