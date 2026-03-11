import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capsules } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const [capsule] = await db
    .select()
    .from(capsules)
    .where(eq(capsules.cancelToken, token))
    .limit(1);
  if (!capsule) {
    return NextResponse.json({ error: "Capsule not found" }, { status: 404 });
  }
  if (capsule.status !== "sealed") {
    return NextResponse.json(
      { error: "Capsule already " + capsule.status },
      { status: 400 }
    );
  }
  await db
    .update(capsules)
    .set({ status: "cancelled" })
    .where(eq(capsules.id, capsule.id));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/capsule/cancelled`);
}
