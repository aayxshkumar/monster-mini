"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTemplateForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, heading, bodyHtml }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create template");
      setOpen(false);
      setName("");
      setSubject("");
      setHeading("");
      setBodyHtml("");
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
        Create Template
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3 w-full max-w-sm"
    >
      <h3 className="text-sm font-semibold">New Email Template</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name"
        required
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Email subject"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <input
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="Heading text"
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
      />
      <textarea
        value={bodyHtml}
        onChange={(e) => setBodyHtml(e.target.value)}
        placeholder="Body HTML"
        rows={3}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
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
