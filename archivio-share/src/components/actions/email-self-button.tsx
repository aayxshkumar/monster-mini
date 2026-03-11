"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

type EmailSelfButtonProps = {
  photoId: string;
  className?: string;
};

export function EmailSelfButton({ photoId, className }: EmailSelfButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/photo/${photoId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText || "Failed to send");
        return;
      }
      setSentTo(email);
      setSent(true);
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="default"
        className={className}
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
      >
        <Mail className="h-4 w-4" />
        Email me this photo
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-2">Email this photo</h3>
            {sent ? (
              <p className="text-muted-foreground text-sm mb-4">
                Check your inbox! We sent the photo to {sentTo}.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-[var(--muted-foreground)]/30 bg-background px-3 py-2 text-sm"
                />
                {error && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? "Sending…" : "Send"}
                  </Button>
                </div>
              </form>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
