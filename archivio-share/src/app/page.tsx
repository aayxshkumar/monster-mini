"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  QrCode,
  Share2,
  Gift,
  ArrowRight,
  Download,
  Instagram,
  Mail,
  ScanLine,
  ChevronDown,
} from "lucide-react";
import { QrScanner } from "@/components/qr-scanner";

const STEPS = [
  {
    icon: Camera,
    title: "Snap a photo",
    description: "Strike a pose at any Archivio-powered photo booth and get your receipt printed instantly.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: QrCode,
    title: "Scan your QR",
    description: "Each receipt has a unique QR code. Scan it with your phone to access your photo digitally.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Share2,
    title: "Share everywhere",
    description: "Save to your camera roll, share on Instagram, or email it to yourself in one tap.",
    gradient: "from-sky-500/20 to-blue-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    icon: Gift,
    title: "Time capsule it",
    description: "Write a message and pick a date. We\u2019ll deliver your photo back to you as a surprise.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
];

const ACTIONS = [
  { icon: Download, label: "Save to device" },
  { icon: Instagram, label: "Share to Instagram" },
  { icon: Mail, label: "Email to yourself" },
  { icon: Gift, label: "Time capsule" },
];

export default function Home() {
  const [code, setCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const router = useRouter();

  const handleFind = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (trimmed.length <= 12) {
      router.push(`/s/${trimmed}`);
    } else {
      router.push(`/photo/${trimmed}`);
    }
  };

  const handleScanResult = (decoded: string) => {
    setScannerOpen(false);
    try {
      const url = new URL(decoded);
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments[0] === "s" && segments[1]) {
        router.push(`/s/${segments[1]}`);
      } else if (segments[0] === "photo" && segments[1]) {
        router.push(`/photo/${segments[1]}`);
      } else {
        router.push(url.pathname);
      }
    } catch {
      if (decoded.length <= 12) {
        router.push(`/s/${decoded}`);
      } else {
        router.push(`/photo/${decoded}`);
      }
    }
  };

  return (
    <div className="font-sans">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:pt-32">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="animate-fade-in-up text-xs font-semibold uppercase tracking-widest text-primary">
            Photo booth meets digital
          </p>
          <h1 className="animate-fade-in-up animate-delay-100 mt-4 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your moment,{" "}
            <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
              preserved
            </span>
          </h1>
          <p className="animate-fade-in-up animate-delay-200 mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Take a photo, get a thermal receipt, and unlock your digital copy.
            Save, share, or turn it into a time capsule.
          </p>
          <div className="animate-fade-in-up animate-delay-300 mt-8 flex items-center justify-center gap-3">
            <a
              href="#find-photo"
              className="animate-pulse-glow inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
            >
              Scan my receipt
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How it works
            </h2>
            <p className="mt-2 text-muted-foreground">
              From booth to phone in seconds.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="animate-fade-in-up group rounded-2xl border border-border/60 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg"
                style={{ animationDelay: `${i * 100 + 100}ms` }}
              >
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${step.gradient} p-3`}
                >
                  <step.icon className={`h-6 w-6 ${step.iconColor}`} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="border-t border-border/50 bg-secondary/30 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Your photo, your way
          </h2>
          <p className="mt-2 text-muted-foreground">
            Every action is one tap away once you scan your QR.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {ACTIONS.map((action) => (
              <div
                key={action.label}
                className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-6 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Find Your Photo CTA */}
      <section id="find-photo" className="px-6 py-20">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <ScanLine className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">
                Find your photo
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Scan the QR code on your printed receipt
              </p>
            </div>

            <button
              onClick={() => setScannerOpen(true)}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Camera className="h-5 w-5" />
              Scan receipt QR
            </button>

            {/* Manual code fallback */}
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowManual((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Or enter code manually
                <ChevronDown className={`h-3 w-3 transition-transform ${showManual ? "rotate-180" : ""}`} />
              </button>
              {showManual && (
                <form onSubmit={handleFind} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. a3bnk7xy"
                    className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                  >
                    Go
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* QR Scanner Modal */}
      <QrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleScanResult}
      />
    </div>
  );
}
