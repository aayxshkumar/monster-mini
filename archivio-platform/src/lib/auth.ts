import { createSupabaseServer } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { PlatformUser, UserRole } from "@/types";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Get the current authenticated user with their platform role and cafe assignment.
 * Returns null if not authenticated, no platform user record exists, or user is disabled.
 */
export async function getCurrentUser(): Promise<PlatformUser | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  // Look up the platform user record by supabaseId
  const [platformUser] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, authUser.id))
    .limit(1);

  if (platformUser) {
    if (!platformUser.isActive) return null;
    return {
      id: platformUser.id,
      supabaseId: platformUser.supabaseId,
      email: platformUser.email,
      name: platformUser.name,
      role: platformUser.role as UserRole,
      cafeId: platformUser.cafeId,
      avatarUrl: platformUser.avatarUrl,
      isActive: platformUser.isActive,
      createdAt: platformUser.createdAt,
      updatedAt: platformUser.updatedAt,
    };
  }

  // Check for pre-provisioned user by email (created via admin invite before signup)
  const email = (authUser.email ?? "").toLowerCase();
  const [preProvisioned] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (preProvisioned && preProvisioned.supabaseId.startsWith("pending_")) {
    // Link the pre-provisioned record to the real Supabase auth user
    await db
      .update(users)
      .set({ supabaseId: authUser.id, updatedAt: Date.now() })
      .where(eq(users.id, preProvisioned.id));

    if (!preProvisioned.isActive) return null;

    return {
      id: preProvisioned.id,
      supabaseId: authUser.id,
      email: preProvisioned.email,
      name: preProvisioned.name,
      role: preProvisioned.role as UserRole,
      cafeId: preProvisioned.cafeId,
      avatarUrl: preProvisioned.avatarUrl,
      isActive: preProvisioned.isActive,
      createdAt: preProvisioned.createdAt,
      updatedAt: Date.now(),
    };
  }

  // Auto-provision: first login creates the user record.
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
  const role: UserRole = isSuperAdmin ? "super_admin" : "cafe_operator";
  const now = Date.now();
  const { nanoid } = await import("nanoid");
  const id = nanoid();

  const newUser: typeof users.$inferInsert = {
    id,
    supabaseId: authUser.id,
    email,
    name: authUser.user_metadata?.full_name ?? email.split("@")[0],
    role,
    cafeId: null,
    avatarUrl: authUser.user_metadata?.avatar_url ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(users).values(newUser).onConflictDoNothing();

  // Re-read to handle race condition: if onConflictDoNothing skipped our insert,
  // return the actual record from the database instead of the phantom local ID
  const [actual] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, authUser.id))
    .limit(1);

  if (actual) {
    if (!actual.isActive) return null;
    return {
      id: actual.id,
      supabaseId: actual.supabaseId,
      email: actual.email,
      name: actual.name,
      role: actual.role as UserRole,
      cafeId: actual.cafeId,
      avatarUrl: actual.avatarUrl,
      isActive: actual.isActive,
      createdAt: actual.createdAt,
      updatedAt: actual.updatedAt,
    };
  }

  return null;
}

/** Require a specific role. Throws if user doesn't have it. */
export async function requireRole(...allowedRoles: UserRole[]): Promise<PlatformUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (!allowedRoles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

/** Require super_admin role. */
export async function requireSuperAdmin(): Promise<PlatformUser> {
  return requireRole("super_admin");
}

/** Require at least cafe_admin for a specific cafe. */
export async function requireCafeAdmin(cafeId: string): Promise<PlatformUser> {
  const user = await requireRole("super_admin", "cafe_admin");
  if (user.role === "cafe_admin" && user.cafeId !== cafeId) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Require any cafe member (admin or operator) for a specific cafe. */
export async function requireCafeMember(cafeId: string): Promise<PlatformUser> {
  const user = await requireRole("super_admin", "cafe_admin", "cafe_operator");
  if (user.role !== "super_admin" && user.cafeId !== cafeId) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
