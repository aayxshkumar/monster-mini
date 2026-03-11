import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional(),
  heading: z.string().optional(),
  bodyHtml: z.string().optional(),
  footerText: z.string().optional(),
  previewText: z.string().optional(),
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
  const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(t);
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
    .update(emailTemplates)
    .set({ ...body, updatedAt: now })
    .where(eq(emailTemplates.id, id));
  return NextResponse.json({ ok: true });
}
