import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, requireCafeAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes, cafeConfigs, users, cafeTemplates } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { CafeConfigEditor } from "@/components/admin/cafe-config-editor";
import { CafeMemberList } from "@/components/admin/cafe-member-list";
import { TemplateManager } from "@/components/admin/template-manager";
import type { CafeFeatureFlags } from "@/types";

type Props = { params: Promise<{ id: string }> };

export default async function CafeDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    await requireCafeAdmin(id);
  } catch {
    redirect("/admin");
  }

  const [cafe] = await db.select().from(cafes).where(eq(cafes.id, id));
  if (!cafe) notFound();

  const [config] = await db
    .select()
    .from(cafeConfigs)
    .where(eq(cafeConfigs.cafeId, id));
  const members = await db.select().from(users).where(eq(users.cafeId, id));
  const templates = await db
    .select()
    .from(cafeTemplates)
    .where(eq(cafeTemplates.cafeId, id));

  const parsedConfig = config
    ? {
        ...config,
        features: JSON.parse(config.features) as CafeFeatureFlags,
        sectionOrder: JSON.parse(config.sectionOrder ?? "[]") as string[],
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{cafe.name}</h1>
          <p className="text-sm text-muted-foreground">
            /{cafe.slug}
            {cafe.piServerUrl && ` — Pi: ${cafe.piServerUrl}`}
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Booth:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://archivio-dashboard.vercel.app"}/{cafe.slug}/booth
              </code>
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Share:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {process.env.NEXT_PUBLIC_SHARE_URL ?? "https://archivio-share.vercel.app"}/{cafe.slug}
              </code>
            </p>
          </div>
        </div>
        <Link
          href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://archivio-dashboard.vercel.app"}/${cafe.slug}/booth`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          Open Booth
        </Link>
      </div>

      {/* Cafe Config Editor — controls EVERYTHING */}
      {parsedConfig && (
        <CafeConfigEditor cafeId={id} piServerUrl={cafe.piServerUrl} config={parsedConfig} />
      )}

      {/* Team Members */}
      <CafeMemberList cafeId={id} members={members} />

      {/* Templates */}
      <TemplateManager
        cafeId={id}
        templates={templates}
        dashboardUrl={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"}
      />
    </div>
  );
}
