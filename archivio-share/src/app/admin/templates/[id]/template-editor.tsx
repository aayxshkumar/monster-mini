"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Template = {
  id: string;
  name: string | null;
  subject: string | null;
  heading: string | null;
  bodyHtml: string | null;
  footerText: string | null;
  previewText: string | null;
  isActive: boolean | null;
};

export function TemplateEditor({ template }: { template: Template }) {
  const router = useRouter();
  const [name, setName] = useState(template.name ?? "");
  const [subject, setSubject] = useState(template.subject ?? "");
  const [heading, setHeading] = useState(template.heading ?? "");
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml ?? "");
  const [footerText, setFooterText] = useState(template.footerText ?? "");
  const [isActive, setIsActive] = useState(template.isActive ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          heading,
          bodyHtml,
          footerText,
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
        <label className="block text-sm font-medium mb-1">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Heading</label>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Body HTML</label>
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={6}
          className="w-full rounded-md border px-3 py-2 text-sm font-mono"
        />
        <div className="mt-2 rounded border p-4 bg-muted/30 text-sm">
          <p className="font-medium mb-2">Preview</p>
          <div dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>(empty)</p>" }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Footer text</label>
        <input
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
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
