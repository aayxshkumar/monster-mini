import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { photos, capsules, emailTemplates } from "@/lib/schema";
import { eq, and, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { capsuleBodySchema } from "@/lib/validation";
import {
  RATE_LIMIT_CAPSULES_PER_PHOTO,
  RATE_LIMIT_CAPSULES_PER_EMAIL_PER_DAY,
  DELIVERY_OPTIONS,
} from "@/lib/constants";
import { scheduleCapsuleDelivery } from "@/lib/qstash";
import { resend, getResendFrom } from "@/lib/resend";
import React from "react";
import { render } from "@react-email/render";
import ConfirmationEmail from "@/components/email/confirmation-email";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let body: z.infer<typeof capsuleBodySchema>;
  try {
    body = capsuleBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, body.photoId))
    .limit(1);
  if (!photo || photo.status !== "uploaded") {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) {
    return NextResponse.json({ error: "Photo expired" }, { status: 404 });
  }

  const sinceDay = now - ONE_DAY_MS;
  const capsulesForPhoto = await db
    .select()
    .from(capsules)
    .where(eq(capsules.photoId, body.photoId));
  if (capsulesForPhoto.length >= RATE_LIMIT_CAPSULES_PER_PHOTO) {
    return NextResponse.json(
      { error: `Max ${RATE_LIMIT_CAPSULES_PER_PHOTO} capsules per photo` },
      { status: 429 }
    );
  }

  const capsulesForEmail = await db
    .select()
    .from(capsules)
    .where(
      and(eq(capsules.email, body.email), gt(capsules.createdAt, sinceDay))
    );
  if (capsulesForEmail.length >= RATE_LIMIT_CAPSULES_PER_EMAIL_PER_DAY) {
    return NextResponse.json(
      { error: `Max ${RATE_LIMIT_CAPSULES_PER_EMAIL_PER_DAY} capsules per email per day` },
      { status: 429 }
    );
  }

  const capsuleId = nanoid();
  const cancelToken = nanoid();
  const deliverAtSec = body.deliverAt;
  const deliverAtMs = deliverAtSec * 1000;
  const deliverAtLabel =
    body.deliveryOption === "custom"
      ? new Date(deliverAtMs).toLocaleDateString()
      : DELIVERY_OPTIONS[body.deliveryOption]?.label ?? String(deliverAtSec);

  // Auto-resolve email template: when includeTemplate is checked but no specific
  // templateId was provided, find the active template for this photo's event
  let resolvedTemplateId = body.emailTemplateId ?? null;
  if (body.includeTemplate && !resolvedTemplateId && photo.eventId) {
    const [tmpl] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(and(eq(emailTemplates.eventId, photo.eventId), eq(emailTemplates.isActive, true)))
      .limit(1);
    if (tmpl) resolvedTemplateId = tmpl.id;
  }

  await db.insert(capsules).values({
    id: capsuleId,
    photoId: body.photoId,
    email: body.email,
    message: body.message,
    includeTemplate: body.includeTemplate ?? false,
    deliveryOption: body.deliveryOption,
    deliverAt: deliverAtSec,
    status: "sealed",
    cancelToken,
    emailTemplateId: resolvedTemplateId,
    createdAt: Math.floor(now / 1000),
  });

  const messageId = await scheduleCapsuleDelivery(capsuleId, deliverAtSec);
  if (messageId) {
    await db
      .update(capsules)
      .set({ qstashMessageId: messageId })
      .where(eq(capsules.id, capsuleId));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cancelUrl = `${appUrl.replace(/\/$/, "")}/api/capsule/cancel?token=${cancelToken}`;

  if (resend) {
    const html = await render(
      React.createElement(ConfirmationEmail, {
        cancelUrl,
        deliverAtLabel,
      })
    );
    await resend.emails.send({
      from: getResendFrom(),
      to: body.email,
      subject: "Your time capsule is sealed",
      html,
    });
  }

  return NextResponse.json({ ok: true, capsuleId });
}
