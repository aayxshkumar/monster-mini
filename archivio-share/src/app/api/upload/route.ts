import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { uploadToR2 } from "@/lib/r2";
import { verifyUploadSignature } from "@/lib/hmac";
import { SHARE_SECRET } from "@/lib/constants";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const photoId = formData.get("photoId") as string | null;
    const shortCode = formData.get("shortCode") as string | null;
    const timestampStr = formData.get("timestamp") as string | null;
    const signature = formData.get("signature") as string | null;
    const eventId = (formData.get("eventId") as string | null) ?? null;
    const cafeSlug = (formData.get("cafeSlug") as string | null) ?? null;
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : NaN;
    if (
      !photoId ||
      !shortCode ||
      shortCode.length !== 8 ||
      !Number.isFinite(timestamp) ||
      !signature
    ) {
      return NextResponse.json(
        { error: "Missing or invalid photoId, shortCode, timestamp, or signature" },
        { status: 400 }
      );
    }
    if (Date.now() - timestamp > MAX_AGE_MS) {
      return NextResponse.json({ error: "Request expired" }, { status: 401 });
    }
    if (!verifyUploadSignature(SHARE_SECRET, photoId, shortCode, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const originalFile = formData.get("original") as File | null;
    const thumbnailFile = formData.get("thumbnail") as File | null;
    const socialFile = formData.get("social") as File | null;
    if (!originalFile?.size || !thumbnailFile?.size || !socialFile?.size) {
      return NextResponse.json(
        { error: "Missing original, thumbnail, or social image" },
        { status: 400 }
      );
    }
    const prefix = `photos/${photoId}`;
    const originalKey = `${prefix}/original`;
    const thumbKey = `${prefix}/thumb`;
    const socialKey = `${prefix}/social`;
    const [originalBuf, thumbBuf, socialBuf] = await Promise.all([
      originalFile.arrayBuffer().then((a) => Buffer.from(a)),
      thumbnailFile.arrayBuffer().then((a) => Buffer.from(a)),
      socialFile.arrayBuffer().then((a) => Buffer.from(a)),
    ]);
    const [originalUrl, thumbnailUrl, socialUrl] = await Promise.all([
      uploadToR2(originalKey, originalBuf, originalFile.type || "image/webp"),
      uploadToR2(thumbKey, thumbBuf, thumbnailFile.type || "image/webp"),
      uploadToR2(socialKey, socialBuf, socialFile.type || "image/webp"),
    ]);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = eventId
      ? null
      : now + 90 * 24 * 60 * 60; // default 90 days if no event
    await db
      .insert(photos)
      .values({
        id: photoId,
        eventId,
        cafeSlug,
        shortCode,
        status: "uploaded",
        originalUrl,
        thumbnailUrl,
        socialUrl,
        fileSize: originalBuf.length,
        width: null,
        height: null,
        expiresAt,
        viewCount: 0,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: photos.id,
        set: {
          status: "uploaded",
          originalUrl,
          thumbnailUrl,
          socialUrl,
          fileSize: originalBuf.length,
          expiresAt,
        },
      });
    return NextResponse.json({ ok: true, id: photoId }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
