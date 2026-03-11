import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { resend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const checks: Record<string, boolean | string> = {};

  try {
    await db.select().from(photos).limit(1);
    checks.db = true;
  } catch {
    checks.db = false;
  }

  try {
    const hasR2 = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID);
    const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    checks.r2 = hasR2;
    checks.blob = hasBlob;
    checks.storage = hasR2 ? "r2" : hasBlob ? "vercel-blob" : "local";
  } catch {
    checks.r2 = false;
    checks.blob = false;
    checks.storage = "unavailable";
  }

  try {
    checks.resend = Boolean(resend);
  } catch {
    checks.resend = false;
  }

  const ok = checks.db === true && (checks.r2 === true || checks.blob === true || checks.storage === "local");
  return NextResponse.json(
    { ok, checks },
    { status: ok ? 200 : 503, headers: CORS_HEADERS }
  );
}
