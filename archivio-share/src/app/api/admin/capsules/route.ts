import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { capsules } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const status = url.searchParams.get("status") ?? "all";
  const limit = 50;
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(capsules);

  const rows =
    status !== "all"
      ? await db
          .select()
          .from(capsules)
          .where(eq(capsules.status, status))
          .orderBy(desc(capsules.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(capsules)
          .orderBy(desc(capsules.createdAt))
          .limit(limit)
          .offset(offset);

  return NextResponse.json({
    capsules: rows,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / limit),
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  let deleted = 0;
  for (const id of ids) {
    const result = await db.delete(capsules).where(eq(capsules.id, id));
    if (result.rowsAffected > 0) deleted++;
  }

  return NextResponse.json({ deleted });
}
