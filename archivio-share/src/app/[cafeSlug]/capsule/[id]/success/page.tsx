import Link from "next/link";

export default async function CafeCapsuleSuccessPage({
  params,
}: {
  params: Promise<{ cafeSlug: string; id: string }>;
}) {
  const { cafeSlug, id } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 font-sans">
      <h1 className="mb-2 text-xl font-semibold">Time capsule sealed</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        We sent a confirmation email with a link to cancel if you change your mind.
      </p>
      <Link
        href={`/${cafeSlug}/photo/${id}`}
        className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
      >
        Back to photo
      </Link>
    </div>
  );
}
