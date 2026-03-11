import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cafes, cafeConfigs, cafeTemplates, users } from "@/lib/schema";
import { requireSuperAdmin, requireCafeAdmin } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError, safeJsonParse } from "@/lib/utils";
import { syncCafeToShare } from "@/lib/share-sync";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** GET /api/cafes/[id] — Get cafe details + config */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireCafeAdmin(id);

    const [cafe] = await db.select().from(cafes).where(eq(cafes.id, id));
    if (!cafe) return jsonError("Cafe not found", 404);

    const [config] = await db.select().from(cafeConfigs).where(eq(cafeConfigs.cafeId, id));

    // Only return safe member fields (exclude supabaseId)
    const members = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.cafeId, id));

    return jsonOk({
      cafe,
      config: config
        ? { ...config, features: safeJsonParse(config.features, {}) }
        : null,
      members,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** PATCH /api/cafes/[id] — Update cafe details (super_admin or cafe_admin) */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await requireCafeAdmin(id);

    // Verify cafe exists
    const [cafe] = await db.select().from(cafes).where(eq(cafes.id, id));
    if (!cafe) return jsonError("Cafe not found", 404);

    const body = await request.json();
    const now = Date.now();

    const cafeUpdates: Record<string, unknown> = { updatedAt: now };

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonError("Name must be a non-empty string");
      }
      cafeUpdates.name = body.name.trim();
    }
    if (body.piServerUrl !== undefined) {
      if (body.piServerUrl !== null && typeof body.piServerUrl === "string" && body.piServerUrl.trim()) {
        try {
          const parsed = new URL(body.piServerUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            return jsonError("Pi server URL must use http or https");
          }
          cafeUpdates.piServerUrl = body.piServerUrl.trim();
        } catch {
          return jsonError("Invalid Pi server URL format");
        }
      } else {
        cafeUpdates.piServerUrl = null;
      }
    }
    if (body.isActive !== undefined) {
      cafeUpdates.isActive = body.isActive === true;
    }
    if (body.logoUrl !== undefined) cafeUpdates.logoUrl = body.logoUrl;

    await db.update(cafes).set(cafeUpdates).where(eq(cafes.id, id));

    const [updated] = await db.select().from(cafes).where(eq(cafes.id, id));
    if (updated) {
      syncCafeToShare(updated.slug, updated.name, updated.logoUrl);
    }

    return jsonOk({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE /api/cafes/[id] — Delete cafe (super_admin only) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await requireSuperAdmin();

    // Verify cafe exists
    const [cafe] = await db.select().from(cafes).where(eq(cafes.id, id));
    if (!cafe) return jsonError("Cafe not found", 404);

    // Cascade cleanup: unassign users, delete templates, delete config, then delete cafe
    await db
      .update(users)
      .set({ cafeId: null, role: "cafe_operator", updatedAt: Date.now() })
      .where(eq(users.cafeId, id));
    await db.delete(cafeTemplates).where(eq(cafeTemplates.cafeId, id));
    await db.delete(cafeConfigs).where(eq(cafeConfigs.cafeId, id));
    await db.delete(cafes).where(eq(cafes.id, id));

    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
