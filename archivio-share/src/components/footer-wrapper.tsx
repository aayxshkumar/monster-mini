"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { Navbar } from "./navbar";

export function NavbarWrapper() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <Navbar />;
}

export function FooterWrapper() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <Footer />;
}
