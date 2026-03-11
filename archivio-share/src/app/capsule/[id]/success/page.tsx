import Link from "next/link";

export default async function CapsuleSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <h1 className="text-xl font-semibold mb-2">Time capsule sealed</h1>
      <p className="text-muted-foreground text-center text-sm mb-6">
        We sent a confirmation email with a link to cancel if you change your mind.
      </p>
      <Link
        href={`/photo/${id}`}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-foreground text-background hover:bg-foreground/90"
      >
        Back to photo
      </Link>
    </div>
  );
}
