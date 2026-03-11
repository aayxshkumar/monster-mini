"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Photo = {
  id: string;
  shortCode: string | null;
  status: string | null;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  socialUrl: string | null;
  fileSize: number | null;
  viewCount: number | null;
  createdAt: number | null;
};

export function PhotoGrid({
  initialPhotos,
  page,
  totalPages,
}: {
  initialPhotos: Photo[];
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [photos] = useState(initialPhotos);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === photos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(photos.map((p) => p.id)));
    }
  }, [selected.size, photos]);

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selected.size} photo${selected.size > 1 ? "s" : ""}? This also removes associated capsules and stored files. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }, [selected, router]);

  const formatDate = (ts: number | null) => {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={selectAll}
          className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {selected.size === photos.length && photos.length > 0
            ? "Deselect all"
            : "Select all"}
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-xs text-foreground/40">
              {selected.size} selected
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : `Delete (${selected.size})`}
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-foreground/10">
          <p className="text-sm text-foreground/40">No photos uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo) => {
            const isSelected = selected.has(photo.id);
            return (
              <div
                key={photo.id}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-foreground/10 hover:border-foreground/20"
                }`}
                onClick={() => toggleSelect(photo.id)}
              >
                {/* Checkbox */}
                <div
                  className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-white/60 bg-black/20 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>

                {/* Image */}
                <div className="aspect-square bg-foreground/5">
                  {photo.thumbnailUrl ? (
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.shortCode ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-8 w-8 text-foreground/15" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-0.5 p-2.5">
                  <p className="text-xs font-mono font-medium truncate">
                    {photo.shortCode ?? photo.id.slice(0, 8)}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-foreground/40">
                    <span>{photo.viewCount ?? 0} views</span>
                    <span>·</span>
                    <span>{formatSize(photo.fileSize)}</span>
                  </div>
                  <p className="text-[10px] text-foreground/30">
                    {formatDate(photo.createdAt)}
                  </p>
                </div>

                {/* View link */}
                <Link
                  href={`/photo/${photo.id}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-2 z-10 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <Link
              href={`/admin/photos?page=${page - 1}`}
              className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/60 hover:border-foreground/20"
            >
              ← Prev
            </Link>
          )}
          <span className="text-xs text-foreground/40">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/photos?page=${page + 1}`}
              className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/60 hover:border-foreground/20"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
