"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";

const FULLSCREEN_SEGMENTS = ["/booth", "/kiosk"];

export function FooterWrapper() {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_SEGMENTS.some(
    (seg) => pathname.endsWith(seg) || pathname.includes(`${seg}/`)
  );
  if (isFullscreen) return null;
  return <Footer />;
}
