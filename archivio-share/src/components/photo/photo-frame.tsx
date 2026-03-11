import Image from "next/image";
import Link from "next/link";
import { ShareButton } from "@/components/actions/share-button";
import { SaveButton } from "@/components/actions/save-button";
import { InstagramShareButton } from "@/components/actions/instagram-share-button";
import { EmailSelfButton } from "@/components/actions/email-self-button";

type PhotoFrameProps = {
  photoId: string;
  thumbnailUrl: string | null;
  socialUrl: string | null;
  originalUrl?: string | null;
  eventId?: string | null;
  expiresAt?: number | null;
  eventName?: string | null;
  cafeName?: string | null;
  cafeSlug?: string | null;
};

function ExpiryBadge({ expiresAt }: { expiresAt: number }) {
  const now = Date.now();
  const remaining = expiresAt - now;
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));

  if (days <= 0) return null;

  const isUrgent = days <= 7;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isUrgent
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      }`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      {isUrgent
        ? `Expires in ${days} day${days !== 1 ? "s" : ""} — save it now!`
        : `Available for ${days} more day${days !== 1 ? "s" : ""}`}
    </div>
  );
}

export function PhotoFrame({
  photoId,
  thumbnailUrl,
  socialUrl,
  originalUrl,
  expiresAt,
  eventName,
  cafeName,
  cafeSlug,
}: PhotoFrameProps) {
  const imageUrl = thumbnailUrl || socialUrl || null;
  if (!imageUrl) return null;
  const prefix = cafeSlug ? `/${cafeSlug}` : "";
  const photoUrl = `${prefix}/photo/${photoId}`;
  const brandName = cafeName || eventName;

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in-up">
      {/* Event branding strip */}
      {eventName && (
        <div className="animate-fade-in-up animate-delay-100 mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {eventName}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="animate-fade-in-up animate-delay-100 text-center mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {eventName ? "Your Photo" : "Your Photo"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tap below to save or share
        </p>
      </div>

      {/* Expiry badge */}
      {expiresAt != null && (
        <div className="animate-fade-in-up animate-delay-200 mb-4 text-center">
          <ExpiryBadge expiresAt={expiresAt} />
        </div>
      )}

      {/* Photo container */}
      <div className="animate-fade-in-up animate-delay-200 relative mx-auto" style={{ perspective: "800px" }}>
        <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-2xl shadow-black/10 dark:shadow-black/40 transition-transform duration-500 hover:rotate-0 rotate-[-0.5deg]">
          <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted">
            <Image
              src={imageUrl}
              alt="Your photobooth photo"
              fill
              className="object-contain animate-fade-in-up animate-delay-300"
              unoptimized
            />
          </div>
          {brandName && (
            <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Printed at {brandName}
            </p>
          )}
        </div>
      </div>

      {/* Primary actions */}
      <div className="animate-fade-in-up animate-delay-400 mt-6 flex gap-2 justify-center" data-photo-actions>
        <SaveButton photoId={photoId} imageUrl={imageUrl} />
        <ShareButton
          photoId={photoId}
          photoUrl={photoUrl}
          imageUrl={imageUrl}
        />
      </div>

      {/* Secondary actions */}
      <div className="animate-fade-in-up animate-delay-500 mt-3 flex flex-wrap gap-2 justify-center">
        <InstagramShareButton
          photoId={photoId}
          imageUrl={imageUrl}
          originalUrl={originalUrl || socialUrl}
        />
        <EmailSelfButton photoId={photoId} />
        <Link
          href={`${prefix}/capsule/${photoId}`}
          className="inline-flex items-center justify-center rounded-full text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent transition-colors"
        >
          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
          </svg>
          Time capsule
        </Link>
      </div>
    </div>
  );
}
