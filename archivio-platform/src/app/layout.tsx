import type { Metadata } from "next";
import { Montserrat, Inconsolata } from "next/font/google";
import { Toaster } from "sonner";
import { Footer } from "@/components/footer";
import { ThemeProvider } from "@/components/theme-provider";
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

export const metadata: Metadata = {
  title: "Archivio Platform",
  description: "Multi-tenant photo booth management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${inconsolata.variable} flex min-h-screen flex-col bg-background font-sans antialiased`}>
        <ThemeProvider>
          <div className="flex-1">{children}</div>
          <Footer />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
