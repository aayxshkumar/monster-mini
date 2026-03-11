"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trash2,
  Download,
  Printer,
  LayoutTemplate,
  Filter,
  Image as ImageIcon,
  Camera,
} from "lucide-react";

interface GalleryItem {
  id: string;
  filename: string;
  type: string;
  template_id: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const params = useParams<{ cafeSlug: string }>();
  const cafeSlug = params.cafeSlug;
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listGallery(filter === "all" ? undefined : filter);
      setItems(data);
    } catch {
      toast.error("Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.deleteGalleryItem(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (previewItem?.id === id) setPreviewItem(null);
        toast.success("Deleted");
      } catch {
        toast.error("Delete failed");
      }
    },
    [previewItem],
  );

  const handlePrintFromGallery = useCallback(async (item: GalleryItem) => {
    try {
      const res = await fetch(api.galleryImageUrl(item.filename));
      const blob = await res.blob();
      const jobId = `gal_${Date.now()}`;
      await api.printImage(blob, jobId, {
        algorithm: "atkinson",
        contrast: 1.4,
        brightness: 1.05,
      });
      toast.success("Print job queued!");
    } catch (err: unknown) {
      toast.error(
        `Print failed: ${err instanceof Error ? err.message : "Error"}`,
      );
    }
  }, []);

  const typeLabel = (t: string) => {
    if (t === "print") return "Print";
    if (t === "template_render") return "Template";
    return t;
  };

  const typeBadgeColor = (t: string) => {
    if (t === "print")
      return "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary";
    if (t === "template_render")
      return "bg-warm/10 text-warm-foreground dark:bg-warm/15 dark:text-warm";
    return "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${cafeSlug}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Dashboard</span>
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-lg font-bold tracking-tight">Gallery</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/${cafeSlug}/templates`}>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <LayoutTemplate className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Templates</span>
              </Button>
            </Link>
            <DarkModeToggle />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Filter bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="print">Prints</SelectItem>
                <SelectItem value="template_render">Templates</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>

        {/* Gallery grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot [animation-delay:0.15s]" />
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot [animation-delay:0.3s]" />
            </div>
            <p className="text-xs text-muted-foreground">Loading gallery...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
              <Camera className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                No images yet
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Print from the dashboard or template editor to save images here
              </p>
            </div>
            <Link href={`/${cafeSlug}`}>
              <Button variant="outline" size="sm" className="mt-2">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <Card
                key={item.id}
                className="group relative overflow-hidden cursor-pointer rounded-xl border-border/60 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/30"
                onClick={() => setPreviewItem(item)}
              >
                <div className="aspect-[3/4] bg-muted/20 flex items-center justify-center">
                  <img
                    src={api.galleryImageUrl(item.filename)}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                  <div className="w-full p-2 flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className={`text-[8px] px-1.5 py-0 ${typeBadgeColor(item.type)}`}
                    >
                      {typeLabel(item.type)}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintFromGallery(item);
                        }}
                      >
                        <Printer className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="px-2 py-1.5 border-t">
                  <p className="text-[9px] text-muted-foreground truncate">
                    {new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Preview dialog */}
        <Dialog
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
        >
          <DialogContent className="max-w-lg p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Photo preview</DialogTitle>
              <DialogDescription>Gallery item preview</DialogDescription>
            </DialogHeader>
            {previewItem && (
              <>
                <div className="max-h-[70vh] overflow-auto bg-muted/20 flex items-center justify-center">
                  <img
                    src={api.galleryImageUrl(previewItem.filename)}
                    alt={previewItem.filename}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                </div>
                <div className="p-4 border-t flex items-center justify-between">
                  <div>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] ${typeBadgeColor(previewItem.type)}`}
                    >
                      {typeLabel(previewItem.type)}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(previewItem.created_at).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1"
                      onClick={() => handlePrintFromGallery(previewItem)}
                    >
                      <Printer className="h-3 w-3" /> Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1"
                      asChild
                    >
                      <a
                        href={api.galleryImageUrl(previewItem.filename)}
                        download={previewItem.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3 w-3" /> Download
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1 text-destructive"
                      onClick={() => {
                        handleDelete(previewItem.id);
                        setPreviewItem(null);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
