import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photos, capsules, events, emailTemplates } from "@/lib/schema";
import { sql, desc } from "drizzle-orm";
import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 transition-colors hover:border-foreground/20">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground/40">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && (
        <p className="mt-1 text-xs text-foreground/40">{sub}</p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    sealed: "bg-amber-400",
    delivered: "bg-green-500",
    cancelled: "bg-foreground/30",
    failed: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-foreground/20"}`}
    />
  );
}

export default async function AdminDashboard() {
  await auth();

  const [
    [photoStats],
    [capsuleStats],
    [eventCount],
    [templateCount],
    recentPhotos,
    recentCapsules,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        totalViews: sql<number>`coalesce(sum(${photos.viewCount}), 0)`,
        totalSize: sql<number>`coalesce(sum(${photos.fileSize}), 0)`,
      })
      .from(photos),
    db
      .select({
        total: sql<number>`count(*)`,
        sealed: sql<number>`sum(case when ${capsules.status} = 'sealed' then 1 else 0 end)`,
        delivered: sql<number>`sum(case when ${capsules.status} = 'delivered' then 1 else 0 end)`,
      })
      .from(capsules),
    db.select({ count: sql<number>`count(*)` }).from(events),
    db.select({ count: sql<number>`count(*)` }).from(emailTemplates),
    db
      .select({
        id: photos.id,
        shortCode: photos.shortCode,
        thumbnailUrl: photos.thumbnailUrl,
        viewCount: photos.viewCount,
        createdAt: photos.createdAt,
      })
      .from(photos)
      .orderBy(desc(photos.createdAt))
      .limit(8),
    db
      .select({
        id: capsules.id,
        email: capsules.email,
        status: capsules.status,
        deliverAt: capsules.deliverAt,
        createdAt: capsules.createdAt,
      })
      .from(capsules)
      .orderBy(desc(capsules.createdAt))
      .limit(6),
  ]);

  const storageMB =
    Math.round((Number(photoStats.totalSize) / 1024 / 1024) * 10) / 10;

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-foreground/50">
          Overview of your photo booth sharing service.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Photos"
          value={Number(photoStats.total)}
          sub={`${storageMB} MB stored`}
          href="/admin/photos"
        />
        <StatCard
          label="Total Scans"
          value={Number(photoStats.totalViews)}
          sub="Across all photos"
        />
        <StatCard
          label="Capsules"
          value={Number(capsuleStats.total)}
          sub={`${Number(capsuleStats.sealed ?? 0)} sealed · ${Number(capsuleStats.delivered ?? 0)} delivered`}
          href="/admin/capsules"
        />
        <StatCard
          label="Events"
          value={Number(eventCount.count)}
          sub={`${Number(templateCount.count)} email templates`}
          href="/admin/events"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Photos */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/40">
              Recent Photos
            </h2>
            <Link
              href="/admin/photos"
              className="text-xs font-medium text-foreground/50 hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          {recentPhotos.length === 0 ? (
            <p className="text-sm text-foreground/40">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {recentPhotos.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-foreground/10 bg-foreground/5"
                >
                  {p.thumbnailUrl ? (
                    <img
                      src={p.thumbnailUrl}
                      alt={p.shortCode ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-foreground/30">
                      No thumb
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-[10px] font-mono text-white">
                      {p.shortCode ?? p.id.slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {p.viewCount ?? 0} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Capsules */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/40">
              Recent Capsules
            </h2>
            <Link
              href="/admin/capsules"
              className="text-xs font-medium text-foreground/50 hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          {recentCapsules.length === 0 ? (
            <p className="text-sm text-foreground/40">No capsules yet.</p>
          ) : (
            <div className="space-y-2">
              {recentCapsules.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
                >
                  <StatusDot status={c.status ?? "sealed"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.email}</p>
                    <p className="text-xs text-foreground/40">
                      {c.deliverAt
                        ? `Delivers ${new Date(c.deliverAt * 1000).toLocaleDateString()}`
                        : "Immediate"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/50">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
