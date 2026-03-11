"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Capsule = {
  id: string;
  photoId: string;
  email: string;
  message: string;
  deliveryOption: string | null;
  deliverAt: number | null;
  status: string | null;
  deliveredAt: number | null;
  createdAt: number | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sealed: "bg-amber-100 text-amber-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        styles[status] ?? "bg-foreground/10 text-foreground/50"
      }`}
    >
      {status}
    </span>
  );
}

export function CapsuleList({
  initialCapsules,
  page,
  totalPages,
  currentStatus,
}: {
  initialCapsules: Capsule[];
  page: number;
  totalPages: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === initialCapsules.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(initialCapsules.map((c) => c.id)));
    }
  }, [selected.size, initialCapsules]);

  const handleDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selected.size} capsule${selected.size > 1 ? "s" : ""}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/capsules", {
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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const baseUrl =
    currentStatus === "all"
      ? "/admin/capsules"
      : `/admin/capsules?status=${currentStatus}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={selectAll}
          className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {selected.size === initialCapsules.length && initialCapsules.length > 0
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

      {/* Table */}
      {initialCapsules.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-foreground/10">
          <p className="text-sm text-foreground/40">No capsules found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={selected.size === initialCapsules.length && initialCapsules.length > 0}
                    onChange={selectAll}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-foreground/30"
                  />
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Email
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Status
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Message
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Deliver at
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Created
                </th>
                <th className="p-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/40">
                  Photo
                </th>
              </tr>
            </thead>
            <tbody>
              {initialCapsules.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-foreground/5 transition-colors ${
                      isSelected ? "bg-blue-50/50" : "hover:bg-foreground/[0.02]"
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-foreground/30"
                      />
                    </td>
                    <td className="p-3 font-medium">{c.email}</td>
                    <td className="p-3">
                      <StatusBadge status={c.status ?? "sealed"} />
                    </td>
                    <td className="max-w-[200px] truncate p-3 text-foreground/50">
                      {c.message || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-foreground/50">
                      {formatDate(c.deliverAt)}
                    </td>
                    <td className="p-3 whitespace-nowrap text-foreground/50">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/photo/${c.photoId}`}
                        target="_blank"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link
              href={`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${page - 1}`}
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
              href={`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}page=${page + 1}`}
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
