import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cafeTemplates } from "@/lib/schema";
import { requireCafeAdmin, requireCafeMember } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError, safeJsonParse } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

/** GET /api/templates?cafeId=xxx — List templates for a cafe */
export async function GET(request: NextRequest) {
  try {
    const cafeId = request.nextUrl.searchParams.get("cafeId");
    if (!cafeId) return jsonError("cafeId is required");

    await requireCafeMember(cafeId);

    const templates = await db
      .select({
        id: cafeTemplates.id,
        name: cafeTemplates.name,
        description: cafeTemplates.description,
        thumbnailUrl: cafeTemplates.thumbnailUrl,
        lockedFields: cafeTemplates.lockedFields,
        isDefault: cafeTemplates.isDefault,
        isActive: cafeTemplates.isActive,
        createdAt: cafeTemplates.createdAt,
        updatedAt: cafeTemplates.updatedAt,
      })
      .from(cafeTemplates)
      .where(
        and(eq(cafeTemplates.cafeId, cafeId), eq(cafeTemplates.isActive, true))
      );

    return jsonOk(
      templates.map((t) => ({
        ...t,
        lockedFields: safeJsonParse<string[]>(t.lockedFields, []),
      }))
    );
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/templates — Create a template (admin only) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cafeId, name, description, state, lockedFields, thumbnailUrl } = body;

    if (!cafeId || !name || !state) {
      return jsonError("cafeId, name, and state are required");
    }
    if (typeof name !== "string" || !name.trim()) {
      return jsonError("name must be a non-empty string");
    }
    if (typeof state !== "string" || !state.trim()) {
      return jsonError("state must be a non-empty JSON string");
    }

    await requireCafeAdmin(cafeId);

    const now = Date.now();
    const id = nanoid();

    await db.insert(cafeTemplates).values({
      id,
      cafeId,
      name,
      description: description || "",
      thumbnailUrl: thumbnailUrl || null,
      state,
      lockedFields: JSON.stringify(lockedFields || []),
      isDefault: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return jsonOk({ id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
