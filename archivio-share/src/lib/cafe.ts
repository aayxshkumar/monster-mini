import { db } from "@/lib/db";
import { shareCafes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export interface CafeInfo {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export async function getCafe(slug: string): Promise<CafeInfo | null> {
  const [row] = await db
    .select()
    .from(shareCafes)
    .where(eq(shareCafes.slug, slug))
    .limit(1);
  return row ?? null;
}
