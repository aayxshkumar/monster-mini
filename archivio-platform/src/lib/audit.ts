import { db } from "@/lib/db";
import { auditLog } from "@/lib/schema";
import { nanoid } from "nanoid";

export async function logAudit(
  userId: string,
  cafeId: string | null,
  action: string,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(auditLog).values({
      id: nanoid(),
      userId,
      cafeId,
      action,
      details: details ? JSON.stringify(details) : null,
      createdAt: Date.now(),
    });
  } catch {
    // audit logging should never block the main operation
  }
}
