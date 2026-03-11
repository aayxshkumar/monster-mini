"use client";

import { useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { GOOGLE_FONTS, loadGoogleFont, preloadAllFonts } from "@/lib/fonts";
import { useBoothStore } from "@/store/booth-store";
import { Type, Bold, Italic, Underline } from "lucide-react";

export function FontPicker() {
  const memoFont = useBoothStore((s) => s.memoFont);
  const memoFontSize = useBoothStore((s) => s.memoFontSize);
  const memoBold = useBoothStore((s) => s.memoBold);
  const memoItalic = useBoothStore((s) => s.memoItalic);
  const memoUnderline = useBoothStore((s) => s.memoUnderline);
  const setMemoFont = useBoothStore((s) => s.setMemoFont);
  const setMemoFontSize = useBoothStore((s) => s.setMemoFontSize);
  const setMemoBold = useBoothStore((s) => s.setMemoBold);
  const setMemoItalic = useBoothStore((s) => s.setMemoItalic);
  const setMemoUnderline = useBoothStore((s) => s.setMemoUnderline);

  useEffect(() => {
    loadGoogleFont(memoFont);
  }, [memoFont]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 justify-start gap-2 text-sm">
              <Type className="h-3.5 w-3.5" />
              <span style={{ fontFamily: memoFont }}>{memoFont}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start" onOpenAutoFocus={() => preloadAllFonts()}>
            <ScrollArea className="h-72">
              <div className="p-1">
                {GOOGLE_FONTS.map((f) => (
                  <button
                    key={f.name}
                    onMouseEnter={() => loadGoogleFont(f.name)}
                    onClick={() => {
                      loadGoogleFont(f.name);
                      setMemoFont(f.name);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      memoFont === f.name ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <span style={{ fontFamily: `"${f.name}", sans-serif` }}>{f.name}</span>
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">{f.category}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* B/I/U toggle buttons */}
        <div className="flex gap-0.5">
          <button
            onClick={() => setMemoBold(!memoBold)}
            className={`rounded-md border p-1.5 transition-colors ${memoBold ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMemoItalic(!memoItalic)}
            className={`rounded-md border p-1.5 transition-colors ${memoItalic ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMemoUnderline(!memoUnderline)}
            className={`rounded-md border p-1.5 transition-colors ${memoUnderline ? "bg-foreground text-background border-foreground" : "hover:bg-muted"}`}
            title="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-8 text-xs text-muted-foreground">Size</Label>
        <Slider
          value={[memoFontSize]}
          onValueChange={([v]) => setMemoFontSize(v)}
          min={6}
          max={48}
          step={1}
          className="flex-1"
        />
        <span className="w-8 text-right text-xs text-muted-foreground">{memoFontSize}</span>
      </div>
    </div>
  );
}
