import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { photos, events } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { PhotoFrame } from "@/components/photo/photo-frame";
import { PhotoDeveloping } from "@/components/photo/photo-developing";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) notFound();

  db.update(photos)
    .set({ viewCount: sql`coalesce(${photos.viewCount}, 0) + 1` })
    .where(eq(photos.id, id))
    .run();

  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) {
    notFound();
  }

  if (photo.status === "pending") {
    return <PhotoDeveloping photoId={id} />;
  }

  let eventName: string | null = null;
  if (photo.eventId) {
    const [event] = await db
      .select({ name: events.name })
      .from(events)
      .where(eq(events.id, photo.eventId))
      .limit(1);
    if (event) eventName = event.name;
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-6 py-12 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="relative w-full">
        <PhotoFrame
          photoId={photo.id}
          thumbnailUrl={photo.thumbnailUrl}
          socialUrl={photo.socialUrl}
          originalUrl={photo.originalUrl}
          eventId={photo.eventId}
          expiresAt={photo.expiresAt}
          eventName={eventName}
        />
      </div>
    </div>
  );
}
