import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cafes, cafeConfigs, cafeTemplates } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import type { CafeFeatureFlags } from "@/types";
import { DEFAULT_FEATURE_FLAGS } from "@/types";
import { safeJsonParse } from "@/lib/utils";
import { BoothClient } from "./booth-client";

type Props = { params: Promise<{ slug: string }> };

export default async function BoothPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/booth/${slug}`);

  // Find cafe by slug
  const [cafe] = await db.select().from(cafes).where(eq(cafes.slug, slug));
  if (!cafe) notFound();
  if (!cafe.isActive) notFound();

  // Verify user belongs to this cafe (super_admin can access any)
  if (user.role !== "super_admin" && user.cafeId !== cafe.id) {
    redirect("/");
  }

  // Load config
  const [config] = await db
    .select()
    .from(cafeConfigs)
    .where(eq(cafeConfigs.cafeId, cafe.id));

  const features: CafeFeatureFlags | null = config
    ? safeJsonParse<CafeFeatureFlags>(config.features, DEFAULT_FEATURE_FLAGS)
    : null;
  const sectionOrder: string[] = config
    ? safeJsonParse<string[]>(config.sectionOrder, ["logo", "photo", "memo", "qr", "stamp"])
    : ["logo", "photo", "memo", "qr", "stamp"];

  // Load templates for this cafe
  const templates = await db
    .select()
    .from(cafeTemplates)
    .where(
      and(eq(cafeTemplates.cafeId, cafe.id), eq(cafeTemplates.isActive, true))
    );

  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];

  return (
    <BoothClient
      cafe={{
        id: cafe.id,
        name: cafe.name,
        slug: cafe.slug,
        piServerUrl: cafe.piServerUrl,
        logoUrl: cafe.logoUrl,
      }}
      config={
        config
          ? {
              logoUrl: config.logoUrl,
              headerText: config.headerText ?? "",
              headerTextFont: config.headerTextFont ?? "Inter",
              headerTextSize: config.headerTextSize ?? 12,
              headerHeight: config.headerHeight ?? 64,
              algorithm: config.algorithm ?? "atkinson",
              printBrightness: config.printBrightness ?? "medium",
              photoBorderId: config.photoBorderId ?? "none",
              photoFilter: config.photoFilter ?? "none",
              photoAspectRatio: config.photoAspectRatio ?? "free",
              sectionOrder,
              qrEnabled: config.qrEnabled ?? false,
              qrUrl: config.qrUrl ?? "",
              qrCaption: config.qrCaption ?? "",
              dateStampEnabled: config.dateStampEnabled ?? false,
              timeStampEnabled: config.timeStampEnabled ?? false,
              locationStampEnabled: config.locationStampEnabled ?? false,
              locationText: config.locationText ?? "",
              defaultMemo: config.defaultMemo ?? "",
              memoFont: config.memoFont ?? "Inter",
              memoFontSize: config.memoFontSize ?? 14,
              eventModeEnabled: config.eventModeEnabled ?? false,
              eventName: config.eventName ?? "",
              eventDate: config.eventDate ?? "",
              eventLocation: config.eventLocation ?? "",
            }
          : null
      }
      features={features}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? "",
        thumbnailUrl: t.thumbnailUrl,
        isDefault: t.isDefault ?? false,
        lockedFields: safeJsonParse<string[]>(t.lockedFields, []),
        state: t.state,
      }))}
      user={{
        name: user.name,
        role: user.role,
      }}
    />
  );
}
