import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";
import { nanoid } from "nanoid";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await db.select().from(events);
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { name, slug, date, location } = body;
  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }
  const id = `evt_${nanoid(12)}`;
  await db.insert(events).values({
    id,
    name,
    slug,
    date: date || null,
    location: location || null,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return NextResponse.json({ id, name, slug }, { status: 201 });
}
