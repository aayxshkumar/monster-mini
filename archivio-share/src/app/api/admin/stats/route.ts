import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photos, capsules, events, emailTemplates } from "@/lib/schema";
import { sql, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [[photoStats], [capsuleStats], [eventCount], [templateCount], recentPhotos, recentCapsules] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          totalViews: sql<number>`coalesce(sum(${photos.viewCount}), 0)`,
          totalSize: sql<number>`coalesce(sum(${photos.fileSize}), 0)`,
        })
        .from(photos),
      db
        .select({
          total: sql<number>`count(*)`,
          sealed: sql<number>`count(*) filter (where ${capsules.status} = 'sealed')`,
          delivered: sql<number>`count(*) filter (where ${capsules.status} = 'delivered')`,
          cancelled: sql<number>`count(*) filter (where ${capsules.status} = 'cancelled')`,
          failed: sql<number>`count(*) filter (where ${capsules.status} = 'failed')`,
        })
        .from(capsules),
      db.select({ count: sql<number>`count(*)` }).from(events),
      db.select({ count: sql<number>`count(*)` }).from(emailTemplates),
      db
        .select({
          id: photos.id,
          shortCode: photos.shortCode,
          thumbnailUrl: photos.thumbnailUrl,
          viewCount: photos.viewCount,
          createdAt: photos.createdAt,
        })
        .from(photos)
        .orderBy(desc(photos.createdAt))
        .limit(8),
      db
        .select({
          id: capsules.id,
          email: capsules.email,
          status: capsules.status,
          deliverAt: capsules.deliverAt,
          createdAt: capsules.createdAt,
        })
        .from(capsules)
        .orderBy(desc(capsules.createdAt))
        .limit(5),
    ]);

  return NextResponse.json({
    photos: {
      total: Number(photoStats.total),
      totalViews: Number(photoStats.totalViews),
      totalSizeMB: Math.round(Number(photoStats.totalSize) / 1024 / 1024 * 10) / 10,
    },
    capsules: {
      total: Number(capsuleStats.total),
      sealed: Number(capsuleStats.sealed),
      delivered: Number(capsuleStats.delivered),
      cancelled: Number(capsuleStats.cancelled),
      failed: Number(capsuleStats.failed),
    },
    events: Number(eventCount.count),
    templates: Number(templateCount.count),
    recentPhotos,
    recentCapsules,
  });
}
