import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "super_admin" || user.role === "cafe_admin") {
    redirect("/admin");
  }
  // Cafe operators go to their booth via slug
  if (user.cafeId) {
    const [cafe] = await db.select().from(cafes).where(eq(cafes.id, user.cafeId));
    if (cafe) redirect(`/booth/${cafe.slug}`);
  }
  // Unassigned operator — show a waiting page
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold">Welcome to Archivio</h1>
        <p className="text-muted-foreground">
          Your account hasn&apos;t been assigned to a cafe yet.
          <br />
          Please contact your administrator.
        </p>
      </div>
    </div>
  );
}
