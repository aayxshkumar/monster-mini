import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
  branding: z.string().optional(),
  photoExpiryDays: z.number().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [e] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(e);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = bodySchema.parse(await req.json());
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(events)
    .set({ ...body, updatedAt: now })
    .where(eq(events.id, id));
  return NextResponse.json({ ok: true });
}
