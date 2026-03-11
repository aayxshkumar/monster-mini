import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/schema";
import { nanoid } from "nanoid";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db.select().from(emailTemplates);
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { name, subject, heading, bodyHtml } = body;
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const id = `etpl_${nanoid(12)}`;
  const now = Date.now();
  await db.insert(emailTemplates).values({
    id,
    name,
    subject: subject || null,
    heading: heading || null,
    bodyHtml: bodyHtml || null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ id, name }, { status: 201 });
}
