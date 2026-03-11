import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { CapsuleForm } from "@/components/capsule/capsule-form";

export default async function CafeCapsulePage({
  params,
}: {
  params: Promise<{ cafeSlug: string; id: string }>;
}) {
  const { cafeSlug, id: photoId } = await params;
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo) notFound();
  const now = Date.now();
  if (photo.expiresAt != null && photo.expiresAt < now) notFound();
  if (photo.status !== "uploaded") notFound();

  const imageUrl = photo.thumbnailUrl || photo.socialUrl || photo.originalUrl;

  return (
    <div className="px-6 py-12 font-sans">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
            <svg className="h-7 w-7 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Time capsule</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Write a message and choose when to receive this photo in your inbox.
          </p>
        </div>
        {imageUrl && (
          <div className="mb-8 flex justify-center">
            <div className="relative h-32 w-24 overflow-hidden rounded-xl border border-border/60 bg-muted shadow-lg">
              <Image src={imageUrl} alt="Your photo" fill className="object-cover" unoptimized />
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl shadow-black/5">
          <CapsuleForm photoId={photoId} photoImageUrl={imageUrl} />
        </div>
        <p className="mt-6 text-center">
          <Link
            href={`/${cafeSlug}/photo/${photoId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to photo
          </Link>
        </p>
      </div>
    </div>
  );
}
