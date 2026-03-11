"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Event = {
  id: string;
  name: string | null;
  slug: string | null;
  date: string | null;
  location: string | null;
  organizer: string | null;
  branding: string | null;
  photoExpiryDays: number | null;
  isActive: boolean | null;
};

export function EventEditor({ event }: { event: Event }) {
  const router = useRouter();
  const [name, setName] = useState(event.name ?? "");
  const [slug, setSlug] = useState(event.slug ?? "");
  const [date, setDate] = useState(event.date ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [organizer, setOrganizer] = useState(event.organizer ?? "");
  const [branding, setBranding] = useState(event.branding ?? "");
  const [photoExpiryDays, setPhotoExpiryDays] = useState(event.photoExpiryDays ?? 90);
  const [isActive, setIsActive] = useState(event.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          date: date || null,
          location: location || null,
          organizer: organizer || null,
          branding: branding || null,
          photoExpiryDays,
          isActive,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Organizer</label>
        <input
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Branding (JSON)</label>
        <textarea
          value={branding}
          onChange={(e) => setBranding(e.target.value)}
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Photo expiry (days)</label>
        <input
          type="number"
          min={1}
          value={photoExpiryDays}
          onChange={(e) => setPhotoExpiryDays(parseInt(e.target.value, 10) || 90)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <label htmlFor="isActive">Active</label>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
