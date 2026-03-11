import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getFromR2 } from "@/lib/r2";

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
  if (!photo || photo.status !== "uploaded") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) {
    return NextResponse.json({ error: "Expired" }, { status: 404 });
  }

  const headers = {
    "Content-Type": "image/webp",
    "Content-Disposition": `attachment; filename="archivio-photo-${id}.webp"`,
  };

  if (photo.originalUrl?.startsWith("http")) {
    const res = await fetch(photo.originalUrl);
    if (res.ok && res.body) {
      return new NextResponse(res.body, { headers });
    }
  }

  const key = `photos/${id}/original`;
  const stream = await getFromR2(key);
  if (!stream) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return new NextResponse(stream, { headers });
}
