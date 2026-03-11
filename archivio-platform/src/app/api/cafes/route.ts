import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cafes, cafeConfigs, users } from "@/lib/schema";
import { requireSuperAdmin, requireRole, getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { syncCafeToShare } from "@/lib/share-sync";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { DEFAULT_FEATURE_FLAGS } from "@/types";

/** GET /api/cafes — List cafes (super_admin sees all, cafe_admin sees own) */
export async function GET() {
  try {
    const user = await requireRole("super_admin", "cafe_admin", "cafe_operator");

    if (user.role === "super_admin") {
      const allCafes = await db.select().from(cafes).orderBy(cafes.name);
      return jsonOk(allCafes);
    }

    // Cafe members only see their own cafe
    if (!user.cafeId) return jsonOk([]);
    const [cafe] = await db.select().from(cafes).where(eq(cafes.id, user.cafeId));
    return jsonOk(cafe ? [cafe] : []);
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/cafes — Create a new cafe (super_admin only) */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const { name, slug, piServerUrl } = body;

    if (!name || !slug) return jsonError("Name and slug are required");
    if (!/^[a-z0-9-]+$/.test(slug)) return jsonError("Slug must be lowercase alphanumeric with hyphens");

    // Check slug uniqueness
    const [existing] = await db.select().from(cafes).where(eq(cafes.slug, slug));
    if (existing) return jsonError("Slug already taken", 409);

    const now = Date.now();
    const id = nanoid();

    // Create cafe
    await db.insert(cafes).values({
      id,
      name,
      slug,
      piServerUrl: piServerUrl || null,
      plan: "free",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create default config for the cafe
    await db.insert(cafeConfigs).values({
      cafeId: id,
      features: JSON.stringify(DEFAULT_FEATURE_FLAGS),
      updatedAt: now,
    });

    const user = await getCurrentUser().catch(() => null);
    if (user) logAudit(user.id, id, "cafe.create", { name, slug });

    syncCafeToShare(slug, name, null);

    return jsonOk({ id, slug }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
