import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }
  return NextResponse.json({
    id: photo.id,
    status: photo.status,
    thumbnailUrl: photo.thumbnailUrl,
    socialUrl: photo.socialUrl,
    originalUrl: photo.originalUrl,
    eventId: photo.eventId,
    viewCount: photo.viewCount,
  });
}
