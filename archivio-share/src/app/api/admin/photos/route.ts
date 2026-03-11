import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photos, capsules } from "@/lib/schema";
import { desc, eq, sql, like } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 30;
  const offset = (page - 1) * limit;
  const search = url.searchParams.get("q") ?? "";

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(photos);

  const rows = search
    ? await db
        .select()
        .from(photos)
        .where(like(photos.shortCode, `%${search}%`))
        .orderBy(desc(photos.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(photos)
        .orderBy(desc(photos.createdAt))
        .limit(limit)
        .offset(offset);

  return NextResponse.json({
    photos: rows,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / limit),
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  const { deleteFromR2 } = await import("@/lib/r2");

  let deleted = 0;
  for (const id of ids) {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    if (!photo) continue;

    // Delete associated capsules
    await db.delete(capsules).where(eq(capsules.photoId, id));

    // Delete stored files
    try {
      if (photo.originalUrl) await deleteFromR2(`photos/${id}/original`);
      if (photo.thumbnailUrl) await deleteFromR2(`photos/${id}/thumb`);
      if (photo.socialUrl) await deleteFromR2(`photos/${id}/social`);
    } catch { /* best effort */ }

    await db.delete(photos).where(eq(photos.id, id));
    deleted++;
  }

  return NextResponse.json({ deleted });
}
