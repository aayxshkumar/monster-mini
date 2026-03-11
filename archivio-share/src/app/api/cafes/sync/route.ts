import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shareCafes } from "@/lib/schema";
import { SHARE_SECRET } from "@/lib/constants";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!SHARE_SECRET || authHeader !== `Bearer ${SHARE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { slug, name, logoUrl } = body;

  if (!slug || !name) {
    return NextResponse.json({ error: "slug and name are required" }, { status: 400 });
  }

  await db
    .insert(shareCafes)
    .values({
      slug,
      name,
      logoUrl: logoUrl ?? null,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .onConflictDoUpdate({
      target: shareCafes.slug,
      set: {
        name,
        logoUrl: logoUrl ?? null,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    });

  return NextResponse.json({ ok: true });
}
