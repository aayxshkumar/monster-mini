"use client";

import { QRCodeSVG } from "qrcode.react";

interface ReceiptPreviewProps {
  logo: string | null;
  photo: string | null;
  memo: string;
  qrUrl: string;
  algorithm: string;
}

export function ReceiptPreview({ logo, photo, memo, qrUrl, algorithm }: ReceiptPreviewProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="receipt-paper w-[280px] rounded-sm overflow-hidden">
        {/* Top torn edge */}
        <div className="h-3 bg-gradient-to-b from-muted/50 to-white" />

        {/* Logo section */}
        <div className="flex justify-center px-6 pt-3 pb-2">
          {logo ? (
            <img src={logo} alt="Logo" className="h-14 w-auto object-contain" />
          ) : (
            <div className="flex h-14 items-center justify-center">
              <span className="text-2xl font-black tracking-tight text-foreground">
                YO<span className="relative">U<span className="absolute -top-1 left-[0.35em] text-[0.3em] tracking-normal">..</span></span>{" "}MEE
              </span>
            </div>
          )}
        </div>

        {/* Dotted separator */}
        <div className="mx-4 border-b border-dotted border-muted-foreground/30" />

        {/* Photo section */}
        <div className="px-3 py-3">
          {photo ? (
            <img
              src={photo}
              alt="Photo"
              className="w-full rounded-sm object-cover"
              style={{ imageRendering: "auto" }}
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center rounded-sm bg-muted/40">
              <div className="text-center text-muted-foreground/50">
                <svg className="mx-auto h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs">your photo here</p>
              </div>
            </div>
          )}
        </div>

        {/* Dotted separator */}
        <div className="mx-4 border-b border-dotted border-muted-foreground/30" />

        {/* Memo section */}
        <div className="px-5 py-3 text-center">
          {memo ? (
            <p className="text-[11px] leading-relaxed italic text-foreground/80">
              &ldquo;{memo}&rdquo;
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/40 italic">
              &ldquo;your memo here&rdquo;
            </p>
          )}
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center px-4 pb-2">
          <QRCodeSVG
            value={qrUrl || "https://youmee.app"}
            size={80}
            level="M"
            bgColor="transparent"
          />
          <p className="mt-1 text-[8px] text-muted-foreground/50 tracking-wide uppercase">
            scan for your digital copy
          </p>
        </div>

        {/* Algorithm badge */}
        <div className="flex justify-center pb-3">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[7px] uppercase tracking-widest text-muted-foreground/60">
            {algorithm}
          </span>
        </div>

        {/* Bottom torn edge */}
        <div className="h-4 bg-gradient-to-t from-muted/50 to-white" />
      </div>
    </div>
  );
}
