import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cafeTemplates } from "@/lib/schema";
import { requireCafeAdmin, requireCafeMember } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError, safeJsonParse } from "@/lib/utils";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** GET /api/templates/[id] — Get template with full state */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(cafeTemplates)
      .where(eq(cafeTemplates.id, id));

    if (!template) return jsonError("Template not found", 404);

    // Check user has access to this cafe
    await requireCafeMember(template.cafeId);

    return jsonOk({
      ...template,
      lockedFields: safeJsonParse<string[]>(template.lockedFields, []),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** PATCH /api/templates/[id] — Update template (admin only) */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(cafeTemplates)
      .where(eq(cafeTemplates.id, id));

    if (!template) return jsonError("Template not found", 404);
    await requireCafeAdmin(template.cafeId);

    const body = await request.json();
    const now = Date.now();

    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonError("name must be a non-empty string");
      }
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) updates.description = body.description ?? "";
    if (body.state !== undefined) {
      if (typeof body.state !== "string" || !body.state.trim()) {
        return jsonError("state must be a non-empty JSON string");
      }
      updates.state = body.state;
    }
    if (body.thumbnailUrl !== undefined) updates.thumbnailUrl = body.thumbnailUrl;
    if (body.isDefault !== undefined) {
      // If setting as default, unset other defaults for this cafe
      if (body.isDefault) {
        await db
          .update(cafeTemplates)
          .set({ isDefault: false })
          .where(eq(cafeTemplates.cafeId, template.cafeId));
      }
      updates.isDefault = body.isDefault;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.lockedFields !== undefined) {
      if (!Array.isArray(body.lockedFields)) {
        return jsonError("lockedFields must be an array");
      }
      updates.lockedFields = JSON.stringify(body.lockedFields);
    }

    await db.update(cafeTemplates).set(updates).where(eq(cafeTemplates.id, id));

    return jsonOk({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE /api/templates/[id] — Delete template (admin only) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(cafeTemplates)
      .where(eq(cafeTemplates.id, id));

    if (!template) return jsonError("Template not found", 404);
    await requireCafeAdmin(template.cafeId);

    await db.delete(cafeTemplates).where(eq(cafeTemplates.id, id));

    return jsonOk({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
