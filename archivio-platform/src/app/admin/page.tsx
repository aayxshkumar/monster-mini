import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes, users } from "@/lib/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isSuperAdmin = user.role === "super_admin";

  // Stats
  const [cafeCount] = await db.select({ count: count() }).from(cafes);
  const [userCount] = await db.select({ count: count() }).from(users);

  const recentCafes = isSuperAdmin
    ? await db.select().from(cafes).orderBy(cafes.createdAt).limit(5)
    : user.cafeId
    ? await db.select().from(cafes).where(eq(cafes.id, user.cafeId))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">
          {isSuperAdmin ? "Platform Dashboard" : "Cafe Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuperAdmin
            ? "Manage all cafes, templates, and operators"
            : "Manage your cafe settings and templates"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="group rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cafes
              </p>
              <p className="text-2xl font-bold">{cafeCount.count}</p>
            </div>
          </div>
        </div>
        <div className="group rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Users
              </p>
              <p className="text-2xl font-bold">{userCount.count}</p>
            </div>
          </div>
        </div>
        <div className="group rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20">
              <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Your role
              </p>
              <p className="text-2xl font-bold capitalize">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cafes list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {isSuperAdmin ? "Recent Cafes" : "Your Cafe"}
          </h2>
          {isSuperAdmin && (
            <Link
              href="/admin/cafes"
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              View all
            </Link>
          )}
        </div>

        {recentCafes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No cafes yet</p>
            {isSuperAdmin && (
              <Link
                href="/admin/cafes"
                className="mt-2 inline-block text-xs underline hover:text-foreground"
              >
                Create your first cafe
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-background">
            {recentCafes.map((cafe) => (
              <Link
                key={cafe.id}
                href={`/admin/cafes/${cafe.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{cafe.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cafe.slug} {cafe.piServerUrl ? `— ${cafe.piServerUrl}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      cafe.isActive ? "bg-primary" : "bg-destructive/60"
                    }`}
                  />
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {cafe.plan}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
