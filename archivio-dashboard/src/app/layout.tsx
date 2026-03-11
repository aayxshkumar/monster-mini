import type { Metadata, Viewport } from "next";
import { Montserrat, Inconsolata } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { FooterWrapper } from "@/components/footer-wrapper";
import "./globals.css";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Archivio Photo Booth",
  description: "Print your moments. Thermal photo booth dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${inconsolata.variable} antialiased flex min-h-screen flex-col`}>
        <ThemeProvider>
          <div className="flex-1">{children}</div>
          <FooterWrapper />
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
