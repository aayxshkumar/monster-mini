import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";
import { SHARE_SECRET } from "@/lib/constants";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Signature, X-Timestamp",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function verifySignature(body: string, timestamp: string, signature: string): boolean {
  if (!SHARE_SECRET || !signature || !timestamp) return false;
  const age = Date.now() - Number(timestamp);
  if (isNaN(age) || age > 5 * 60 * 1000 || age < -60_000) return false;
  const expected = createHmac("sha256", SHARE_SECRET)
    .update(`${timestamp}|${body}`)
    .digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/**
 * Server-to-server endpoint for creating/updating events from the platform.
 * Auth: HMAC signature over `${timestamp}|${body}` using SHARE_SECRET.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const timestamp = request.headers.get("X-Timestamp") ?? "";
    const signature = request.headers.get("X-Signature") ?? "";

    if (!verifySignature(rawBody, timestamp, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const body = JSON.parse(rawBody);
    const { cafeId, eventName, eventDate, eventLocation, isActive } = body;

    if (!cafeId || !eventName) {
      return NextResponse.json(
        { error: "cafeId and eventName are required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const slug = `${cafeId}-event`;

    const [existing] = await db
      .select()
      .from(events)
      .where(eq(events.slug, slug))
      .limit(1);

    if (existing) {
      await db
        .update(events)
        .set({
          name: eventName,
          date: eventDate ?? null,
          location: eventLocation ?? null,
          isActive: isActive ?? true,
          updatedAt: now,
        })
        .where(eq(events.id, existing.id));

      return NextResponse.json(
        { ok: true, eventId: existing.id, action: "updated" },
        { headers: CORS_HEADERS },
      );
    }

    const eventId = nanoid();
    await db.insert(events).values({
      id: eventId,
      name: eventName,
      slug,
      date: eventDate ?? null,
      location: eventLocation ?? null,
      organizer: cafeId,
      branding: null,
      photoExpiryDays: null,
      isActive: isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { ok: true, eventId, action: "created" },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error("[events/sync]", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
