import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { photos, emailSelfLog } from "@/lib/schema";
import { eq, and, gt } from "drizzle-orm";
import { resend, getResendFrom } from "@/lib/resend";
import { RATE_LIMIT_EMAIL_SELF_PER_PHOTO_PER_HOUR } from "@/lib/constants";
import React from "react";
import { nanoid } from "nanoid";
import { render } from "@react-email/render";
import PhotoEmail from "@/components/email/photo-email";

const bodySchema = z.object({ email: z.string().email() });
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: photoId } = await params;
  if (!photoId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  let body: { email: string };
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!photo || photo.status !== "uploaded") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  const since = now - WINDOW_MS;
  const recent = await db
    .select()
    .from(emailSelfLog)
    .where(
      and(eq(emailSelfLog.photoId, photoId), gt(emailSelfLog.createdAt, since))
  );
  if (recent.length >= RATE_LIMIT_EMAIL_SELF_PER_PHOTO_PER_HOUR) {
    return NextResponse.json(
      { error: "Rate limit: max 3 emails per photo per hour" },
      { status: 429 }
    );
  }

  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured" },
      { status: 503 }
    );
  }

  const imageUrl = photo.socialUrl || photo.thumbnailUrl || photo.originalUrl;
  if (!imageUrl) {
    return NextResponse.json({ error: "Photo has no image" }, { status: 500 });
  }

  const html = await render(
    React.createElement(PhotoEmail, {
      photoUrl: imageUrl,
      pageUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/photo/${photoId}`
        : undefined,
    })
  );

  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: body.email,
    subject: "Your photobooth photo",
    html,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to send" },
      { status: 500 }
    );
  }

  await db.insert(emailSelfLog).values({
    id: nanoid(),
    photoId,
    email: body.email,
    createdAt: now,
  });

  return NextResponse.json({ ok: true });
}
