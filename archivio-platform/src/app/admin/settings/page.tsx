import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes, users } from "@/lib/schema";
import { sql } from "drizzle-orm";

export default async function SettingsPage() {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/admin");
  }

  const [cafeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cafes);
  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Platform Settings</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-4 space-y-1">
          <p className="text-2xl font-bold">{cafeCount.count}</p>
          <p className="text-xs text-muted-foreground">Total Cafes</p>
        </div>
        <div className="rounded-lg border bg-background p-4 space-y-1">
          <p className="text-2xl font-bold">{userCount.count}</p>
          <p className="text-xs text-muted-foreground">Total Users</p>
        </div>
        <div className="rounded-lg border bg-background p-4 space-y-1">
          <p className="text-2xl font-bold">Turso</p>
          <p className="text-xs text-muted-foreground">Database</p>
        </div>
      </div>

      {/* Environment info */}
      <section className="rounded-lg border bg-background p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Environment
        </h2>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Supabase URL</span>
            <span className="font-mono text-xs">
              {process.env.NEXT_PUBLIC_SUPABASE_URL
                ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
                : "Not set"}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Database</span>
            <span className="font-mono text-xs">
              {process.env.TURSO_DATABASE_URL?.includes("turso.io")
                ? "Turso Cloud"
                : "Local SQLite"}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Dashboard URL</span>
            <span className="font-mono text-xs">
              {process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "Not set"}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Super Admin Emails</span>
            <span className="font-mono text-xs">
              {process.env.SUPER_ADMIN_EMAILS ?? "Not set"}
            </span>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="rounded-lg border bg-background p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Setup Guide
        </h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>1. Create a cafe from the Cafes page</p>
          <p>2. Set the Pi server URL to the Raspberry Pi running archivio-server</p>
          <p>3. Configure feature flags to control what operators can access</p>
          <p>4. Create locked templates to define the booth design</p>
          <p>5. Add team members and assign them to the cafe</p>
          <p>6. Operators log in and access their booth at /booth/cafe-slug</p>
        </div>
      </section>
    </div>
  );
}
