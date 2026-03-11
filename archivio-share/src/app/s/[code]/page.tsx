import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function ShortCodeRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!code || code.length !== 8) notFound();

  const [photo] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.shortCode, code))
    .limit(1);

  if (!photo) notFound();

  redirect(`/photo/${photo.id}`);
}
