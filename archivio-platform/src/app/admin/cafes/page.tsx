import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { CreateCafeForm } from "@/components/admin/create-cafe-form";

export default async function CafesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isSuperAdmin = user.role === "super_admin";

  const allCafes = isSuperAdmin
    ? await db.select().from(cafes).orderBy(cafes.name)
    : user.cafeId
    ? await db.select().from(cafes).where(eq(cafes.id, user.cafeId))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Cafes</h1>
          <p className="text-sm text-muted-foreground">
            Manage photo booth installations
          </p>
        </div>
      </div>

      {isSuperAdmin && <CreateCafeForm />}

      <div className="divide-y rounded-lg border bg-background">
        {allCafes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No cafes created yet
          </div>
        ) : (
          allCafes.map((cafe) => (
            <Link
              key={cafe.id}
              href={`/admin/cafes/${cafe.id}`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {cafe.logoUrl ? (
                  <img
                    src={cafe.logoUrl}
                    alt={cafe.name}
                    className="h-8 w-8 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-xs font-bold">
                    {cafe.name[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{cafe.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{cafe.slug}
                    {cafe.piServerUrl && (
                      <span className="ml-2">
                        Pi: {cafe.piServerUrl}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    cafe.isActive ? "bg-green-500" : "bg-red-400"
                  }`}
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {cafe.plan}
                </span>
                <span className="text-muted-foreground">&#8250;</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
