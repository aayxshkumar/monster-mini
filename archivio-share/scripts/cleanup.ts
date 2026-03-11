import "dotenv/config";
import { db } from "../src/lib/db";
import { photos, capsules } from "../src/lib/schema";
import { lt, and, eq } from "drizzle-orm";

const now = Math.floor(Date.now() / 1000);
const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

async function main() {
  const expiredPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(lt(photos.expiresAt, now));
  for (const p of expiredPhotos) {
    await db.update(photos).set({ status: "expired" }).where(eq(photos.id, p.id));
  }
  console.log(`Marked ${expiredPhotos.length} photos as expired`);

  const deliveredCapsules = await db
    .select({ id: capsules.id })
    .from(capsules)
    .where(
      and(eq(capsules.status, "delivered"), lt(capsules.deliveredAt, ninetyDaysAgo))
    );
  for (const c of deliveredCapsules) {
    await db.delete(capsules).where(eq(capsules.id, c.id));
  }
  console.log(`Deleted ${deliveredCapsules.length} old delivered capsules`);
}

main().catch(console.error);
