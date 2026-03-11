import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailEvents } from "@/lib/schema";
import { nanoid } from "nanoid";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const type = (body as { type?: string }).type ?? "unknown";
  const payload = JSON.stringify(body);
  const capsuleId = (body as { data?: { email_id?: string } }).data?.email_id ?? null;
  await db.insert(emailEvents).values({
    id: nanoid(),
    capsuleId,
    eventType: type,
    payload,
    createdAt: Math.floor(Date.now() / 1000),
  });
  return NextResponse.json({ received: true });
}
