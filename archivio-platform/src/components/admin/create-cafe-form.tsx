"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCafeForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [piUrl, setPiUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleNameChange = (v: string) => {
    setName(v);
    // Auto-generate slug from name
    setSlug(
      v
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cafes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, piServerUrl: piUrl || null }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setName("");
      setSlug("");
      setPiUrl("");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create cafe");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors w-full"
      >
        + Create new cafe
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-background p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold">New Cafe</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="new-cafe-name" className="text-xs text-muted-foreground">Name</label>
          <input
            id="new-cafe-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Blue Bottle Coffee"
            required
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-cafe-slug" className="text-xs text-muted-foreground">Slug (URL)</label>
          <input
            id="new-cafe-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="blue-bottle-sf"
            required
            pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
            title="Lowercase letters, numbers, and hyphens only. Must start and end with a letter or number."
            className="w-full rounded-md border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="new-cafe-pi-url" className="text-xs text-muted-foreground">
          Pi Server URL (optional)
        </label>
        <input
          id="new-cafe-pi-url"
          value={piUrl}
          onChange={(e) => setPiUrl(e.target.value)}
          placeholder="http://192.168.1.50:5000"
          className="w-full rounded-md border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Cafe"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
            setName("");
            setSlug("");
            setPiUrl("");
          }}
          className="rounded-md border px-4 py-2 text-xs hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
