import type { Metadata } from "next";
import { Montserrat, Inconsolata } from "next/font/google";
import { FooterWrapper, NavbarWrapper } from "@/components/footer-wrapper";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const montserrat = Montserrat({
  variable: "--font-sans-override",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inconsolata = Inconsolata({
  variable: "--font-mono-override",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Archivio Share",
  description: "View and share your photobooth photos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${inconsolata.variable} antialiased flex min-h-screen flex-col`}
      >
        <NavbarWrapper />
        <div className="flex-1">{children}</div>
        <FooterWrapper />
      </body>
    </html>
  );
}
