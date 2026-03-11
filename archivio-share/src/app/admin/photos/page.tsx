import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photos } from "@/lib/schema";
import { desc, sql } from "drizzle-orm";
import { PhotoGrid } from "./photo-grid";

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await auth();
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 30;
  const offset = (page - 1) * limit;

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(photos),
    db
      .select()
      .from(photos)
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const totalCount = Number(total);
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
          <p className="mt-1 text-sm text-foreground/50">
            {totalCount} photo{totalCount !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <PhotoGrid
        initialPhotos={rows}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
