"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAPSULE_MESSAGE_MAX_LENGTH, DELIVERY_OPTIONS } from "@/lib/constants";
import { DeliveryPicker } from "./delivery-picker";
import { Button } from "@/components/ui/button";
import { CapsulePreview } from "./capsule-preview";

type CapsuleFormProps = {
  photoId: string;
  photoImageUrl: string | null;
};

export function CapsuleForm({ photoId, photoImageUrl }: CapsuleFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryOption, setDeliveryOption] = useState<keyof typeof DELIVERY_OPTIONS>("1week");
  const [customDate, setCustomDate] = useState("");
  const [includeTemplate, setIncludeTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliverAt =
    deliveryOption === "custom" && customDate
      ? Math.floor(new Date(customDate).getTime() / 1000)
      : (() => {
          const days = DELIVERY_OPTIONS[deliveryOption]?.days ?? 7;
          const d = new Date();
          d.setDate(d.getDate() + days);
          return Math.floor(d.getTime() / 1000);
        })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId,
          email,
          message,
          deliveryOption,
          deliverAt,
          includeTemplate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText || "Failed to create capsule");
        return;
      }
      router.push(`/capsule/${photoId}/success`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium mb-1">Your email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-[var(--muted-foreground)]/30 bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Message for your future self ({message.length}/{CAPSULE_MESSAGE_MAX_LENGTH})
        </label>
        <textarea
          required
          maxLength={CAPSULE_MESSAGE_MAX_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a note to open when this photo is delivered..."
          rows={4}
          className="w-full rounded-md border border-[var(--muted-foreground)]/30 bg-background px-3 py-2 text-sm resize-none"
        />
      </div>
      <DeliveryPicker
        value={deliveryOption}
        onChange={setDeliveryOption}
        customDate={customDate}
        onCustomDateChange={setCustomDate}
      />
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="includeTemplate"
          checked={includeTemplate}
          onChange={(e) => setIncludeTemplate(e.target.checked)}
          className="rounded border-[var(--muted-foreground)]/30"
        />
        <label htmlFor="includeTemplate" className="text-sm">
          Include event template in the email
        </label>
      </div>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
          Preview
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Sealing…" : "Seal time capsule"}
        </Button>
      </div>
      {showPreview && (
        <CapsulePreview
          message={message}
          photoImageUrl={photoImageUrl}
          deliveryOption={deliveryOption}
          customDate={customDate}
          includeTemplate={includeTemplate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </form>
  );
}
