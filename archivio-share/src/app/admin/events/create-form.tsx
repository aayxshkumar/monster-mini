"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateEventForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, date, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      setOpen(false);
      setName("");
      setSlug("");
      setDate("");
      setLocation("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors shrink-0"
      >
        Create Event
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3 w-full max-w-sm"
    >
      <h3 className="text-sm font-semibold">New Event</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Event name"
        required
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
        placeholder="slug (url-safe)"
        required
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border px-4 py-2 text-sm text-foreground/60 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
