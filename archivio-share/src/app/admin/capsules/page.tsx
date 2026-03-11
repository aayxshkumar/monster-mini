import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { capsules } from "@/lib/schema";
import { desc, eq, sql } from "drizzle-orm";
import { CapsuleList } from "./capsule-list";

const STATUSES = ["all", "sealed", "delivered", "cancelled", "failed"] as const;

export default async function AdminCapsulesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await auth();
  const { status = "all", page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 40;
  const offset = (page - 1) * limit;

  const [[{ total }], [counts], rows] = await Promise.all([
    status !== "all"
      ? db
          .select({ total: sql<number>`count(*)` })
          .from(capsules)
          .where(eq(capsules.status, status))
      : db.select({ total: sql<number>`count(*)` }).from(capsules),
    db
      .select({
        all: sql<number>`count(*)`,
        sealed: sql<number>`sum(case when ${capsules.status} = 'sealed' then 1 else 0 end)`,
        delivered: sql<number>`sum(case when ${capsules.status} = 'delivered' then 1 else 0 end)`,
        cancelled: sql<number>`sum(case when ${capsules.status} = 'cancelled' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${capsules.status} = 'failed' then 1 else 0 end)`,
      })
      .from(capsules),
    status !== "all"
      ? db
          .select()
          .from(capsules)
          .where(eq(capsules.status, status))
          .orderBy(desc(capsules.createdAt))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(capsules)
          .orderBy(desc(capsules.createdAt))
          .limit(limit)
          .offset(offset),
  ]);

  const totalCount = Number(total);
  const totalPages = Math.ceil(totalCount / limit);

  const statusCounts: Record<string, number> = {
    all: Number(counts.all ?? 0),
    sealed: Number(counts.sealed ?? 0),
    delivered: Number(counts.delivered ?? 0),
    cancelled: Number(counts.cancelled ?? 0),
    failed: Number(counts.failed ?? 0),
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capsules</h1>
        <p className="mt-1 text-sm text-foreground/50">
          Manage time capsules and scheduled deliveries.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const isActive = status === s;
          return (
            <a
              key={s}
              href={s === "all" ? "/admin/capsules" : `/admin/capsules?status=${s}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-foreground text-background"
                  : "border border-foreground/10 text-foreground/50 hover:border-foreground/20 hover:text-foreground"
              }`}
            >
              {s}
              <span className="ml-1.5 text-[10px] opacity-60">
                {statusCounts[s] ?? 0}
              </span>
            </a>
          );
        })}
      </div>

      <CapsuleList
        initialCapsules={rows}
        page={page}
        totalPages={totalPages}
        currentStatus={status}
      />
    </div>
  );
}
