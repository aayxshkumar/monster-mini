import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { db } from "@/lib/db";
import { capsules, photos, events, emailTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { resend, getResendFrom } from "@/lib/resend";
import React from "react";
import { render } from "@react-email/render";
import CapsuleEmail from "@/components/email/capsule-email";

function buildTemplateHtml(
  template: { heading?: string | null; bodyHtml?: string | null; footerText?: string | null; previewText?: string | null },
  photoUrl: string,
  message: string,
  eventName?: string,
  eventDate?: string,
  eventLocation?: string,
): string {
  const heading = template.heading || "Your time capsule has arrived";
  const footer = template.footerText || "Archivio · Photobooth time capsules";
  const eventLine = [eventName, eventDate, eventLocation].filter(Boolean).join(" · ");
  const bodyContent = template.bodyHtml
    ? template.bodyHtml
        .replace(/\{\{photo\}\}/g, `<img src="${photoUrl}" alt="Your photo" style="max-width:100%;height:auto;border-radius:8px;" />`)
        .replace(/\{\{message\}\}/g, message)
        .replace(/\{\{event\}\}/g, eventLine)
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="background:#f6f9fc;font-family:sans-serif;margin:0;padding:0;">
<div style="margin:0 auto;padding:20px;max-width:560px;">
  <h1 style="color:#333;font-size:20px;margin-bottom:16px;">${heading}</h1>
  ${bodyContent || `<div style="margin:24px 0;"><img src="${photoUrl}" alt="Your photo" style="max-width:100%;height:auto;border-radius:8px;" /></div>
  <p style="color:#333;font-size:14px;line-height:24px;white-space:pre-wrap;">${message}</p>`}
  ${eventLine ? `<hr style="border-color:#e6ebf1;margin:20px 0;"/><p style="color:#666;font-size:12px;">${eventLine}</p>` : ""}
  <hr style="border-color:#e6ebf1;margin:20px 0;"/>
  <p style="color:#8898aa;font-size:12px;">${footer}</p>
</div></body></html>`;
}

async function handler(request: Request) {
  const body = (await request.json()) as { capsuleId?: string };
  const capsuleId = body?.capsuleId;
  if (!capsuleId) {
    return NextResponse.json({ error: "Missing capsuleId" }, { status: 400 });
  }

  const [capsule] = await db
    .select()
    .from(capsules)
    .where(eq(capsules.id, capsuleId))
    .limit(1);
  if (!capsule) {
    return NextResponse.json({ error: "Capsule not found" }, { status: 404 });
  }
  if (capsule.status !== "sealed") {
    return NextResponse.json(
      { error: "Capsule already " + capsule.status },
      { status: 400 }
    );
  }

  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, capsule.photoId))
    .limit(1);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const photoUrl =
    photo.socialUrl || photo.thumbnailUrl || photo.originalUrl;
  if (!photoUrl) {
    return NextResponse.json({ error: "Photo has no image" }, { status: 500 });
  }

  let eventName: string | undefined;
  let eventDate: string | undefined;
  let eventLocation: string | undefined;
  if (photo.eventId) {
    const [ev] = await db
      .select()
      .from(events)
      .where(eq(events.id, photo.eventId))
      .limit(1);
    if (ev) {
      eventName = ev.name ?? undefined;
      eventDate = ev.date ?? undefined;
      eventLocation = ev.location ?? undefined;
    }
  }

  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured" },
      { status: 503 }
    );
  }

  let html: string;
  let subject = "Your time capsule has arrived";

  if (capsule.includeTemplate && capsule.emailTemplateId) {
    const [tmpl] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, capsule.emailTemplateId))
      .limit(1);
    if (tmpl) {
      subject = tmpl.subject || subject;
      html = buildTemplateHtml(tmpl, photoUrl, capsule.message, eventName, eventDate, eventLocation);
    } else {
      html = await render(
        React.createElement(CapsuleEmail, { photoUrl, message: capsule.message, eventName, eventDate, eventLocation })
      );
    }
  } else {
    html = await render(
      React.createElement(CapsuleEmail, { photoUrl, message: capsule.message, eventName, eventDate, eventLocation })
    );
  }

  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: capsule.email,
    subject,
    html,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to send" },
      { status: 500 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(capsules)
    .set({ status: "delivered", deliveredAt: now })
    .where(eq(capsules.id, capsuleId));

  return NextResponse.json({ ok: true });
}

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const verifiedHandler =
  currentKey && nextKey
    ? verifySignatureAppRouter(handler, {
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      })
    : null;

export async function POST(req: Request) {
  if (verifiedHandler) return verifiedHandler(req);
  // When QStash is not configured, allow direct calls (from the local scheduler fallback)
  return handler(req);
}
