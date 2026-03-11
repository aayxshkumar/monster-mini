import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users, cafes } from "@/lib/schema";
import { requireCafeAdmin, getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError } from "@/lib/utils";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendInviteEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** POST /api/cafes/[id]/members — Add a user to this cafe */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: cafeId } = await params;
    await requireCafeAdmin(cafeId);

    const body = await request.json();
    const { email: rawEmail, role } = body;

    if (!rawEmail || typeof rawEmail !== "string") return jsonError("Email is required");
    const email = rawEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Invalid email format");
    }

    if (!["cafe_admin", "cafe_operator"].includes(role)) {
      return jsonError("Role must be cafe_admin or cafe_operator");
    }

    // Check if user already exists in platform
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing) {
      // Protect super_admins — cannot reassign or change their role
      if (existing.role === "super_admin") {
        return jsonError("Cannot reassign a super admin", 403);
      }

      // Prevent stealing users from other cafes
      if (existing.cafeId && existing.cafeId !== cafeId) {
        return jsonError("User is already assigned to another cafe", 409);
      }

      // Update their cafe assignment and role
      await db
        .update(users)
        .set({ cafeId, role, updatedAt: Date.now() })
        .where(eq(users.id, existing.id));

      return jsonOk({ id: existing.id, email: existing.email, name: existing.name, role, cafeId });
    }

    // Pre-provision user — they'll be linked to Supabase on first login via email match
    const now = Date.now();
    const newUser = {
      id: nanoid(),
      supabaseId: `pending_${nanoid(8)}`,
      email,
      name: email.split("@")[0],
      role,
      cafeId,
      avatarUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);

    const [cafe] = await db.select({ name: cafes.name }).from(cafes).where(eq(cafes.id, cafeId));
    if (cafe) {
      const signUpUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://archivio.app"}/login?redirect=/admin`;
      sendInviteEmail({ to: email, cafeName: cafe.name, role, signUpUrl }).catch(() => {});
    }

    const currentUser = await getCurrentUser().catch(() => null);
    if (currentUser) logAudit(currentUser.id, cafeId, "member.add", { email, role });

    return jsonOk({ id: newUser.id, email: newUser.email, name: newUser.name, role, cafeId });
  } catch (err) {
    return handleApiError(err);
  }
}
