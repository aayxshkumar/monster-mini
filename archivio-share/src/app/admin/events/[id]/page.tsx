import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventEditor } from "./event-editor";

export default async function AdminEventEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;
  const [e] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!e) notFound();
  return (
    <div className="p-6 max-w-2xl">
      <Link href="/admin/events" className="text-sm underline mb-4 inline-block">
        ← Events
      </Link>
      <h1 className="text-xl font-semibold">Edit event</h1>
      <EventEditor event={e} />
    </div>
  );
}
