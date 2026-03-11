import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireCafeAdmin } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/utils";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string; memberId: string }> };

/** PATCH /api/cafes/[id]/members/[memberId] — Update member role */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: cafeId, memberId } = await params;
    const currentUser = await requireCafeAdmin(cafeId);

    const body = await request.json();
    const { role } = body;

    if (!["cafe_admin", "cafe_operator"].includes(role)) {
      return jsonError("Role must be cafe_admin or cafe_operator");
    }

    const [member] = await db
      .select()
      .from(users)
      .where(eq(users.id, memberId));

    if (!member) return jsonError("Member not found", 404);
    if (member.cafeId !== cafeId) return jsonError("Member not in this cafe", 403);
    if (member.role === "super_admin") return jsonError("Cannot change super admin role", 403);

    // Prevent admin from demoting themselves (would leave cafe with no admin)
    if (currentUser.id === memberId && role !== "cafe_admin" && currentUser.role === "cafe_admin") {
      return jsonError("Cannot demote yourself. Ask another admin to change your role.", 400);
    }

    await db
      .update(users)
      .set({ role, updatedAt: Date.now() })
      .where(eq(users.id, memberId));

    return jsonOk({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE /api/cafes/[id]/members/[memberId] — Remove member from cafe */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id: cafeId, memberId } = await params;
    const currentUser = await requireCafeAdmin(cafeId);

    // Prevent admin from removing themselves
    if (currentUser.id === memberId) {
      return jsonError("Cannot remove yourself from the cafe", 400);
    }

    const [member] = await db
      .select()
      .from(users)
      .where(eq(users.id, memberId));

    if (!member) return jsonError("Member not found", 404);
    if (member.cafeId !== cafeId) return jsonError("Member not in this cafe", 403);
    if (member.role === "super_admin") return jsonError("Cannot remove super admin", 403);

    // Remove from cafe (don't delete user, just unassign)
    await db
      .update(users)
      .set({ cafeId: null, role: "cafe_operator", updatedAt: Date.now() })
      .where(eq(users.id, memberId));

    return jsonOk({ removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
