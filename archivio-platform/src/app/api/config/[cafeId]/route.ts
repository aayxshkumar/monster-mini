import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cafeConfigs } from "@/lib/schema";
import { requireCafeAdmin, requireCafeMember, getCurrentUser } from "@/lib/auth";
import { jsonOk, jsonError, handleApiError, safeJsonParse } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import type { CafeFeatureFlags } from "@/types";

type Params = { params: Promise<{ cafeId: string }> };

/** GET /api/config/[cafeId] — Get cafe config (any member can read) */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { cafeId } = await params;
    await requireCafeMember(cafeId);

    const [config] = await db
      .select()
      .from(cafeConfigs)
      .where(eq(cafeConfigs.cafeId, cafeId));

    if (!config) return jsonError("Config not found", 404);

    return jsonOk({
      ...config,
      features: safeJsonParse<CafeFeatureFlags>(config.features, {} as CafeFeatureFlags),
      sectionOrder: safeJsonParse<string[]>(config.sectionOrder, []),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PUT /api/config/[cafeId] — Update cafe config (admin only).
 * This is the core admin power — controls everything the operator sees.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { cafeId } = await params;
    await requireCafeAdmin(cafeId);

    const body = await request.json();
    const now = Date.now();

    // Build update object — only set fields that were provided
    const updates: Record<string, unknown> = { updatedAt: now };

    // Branding
    if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl;
    if (body.headerText !== undefined) updates.headerText = body.headerText;
    if (body.headerTextFont !== undefined) updates.headerTextFont = body.headerTextFont;
    if (body.headerTextSize !== undefined) {
      const n = Number(body.headerTextSize);
      if (isNaN(n) || n < 1 || n > 200) return jsonError("headerTextSize must be 1–200");
      updates.headerTextSize = n;
    }
    if (body.headerTextBold !== undefined) updates.headerTextBold = body.headerTextBold === true;
    if (body.headerTextItalic !== undefined) updates.headerTextItalic = body.headerTextItalic === true;
    if (body.headerHeight !== undefined) {
      const n = Number(body.headerHeight);
      if (isNaN(n) || n < 0 || n > 500) return jsonError("headerHeight must be 0–500");
      updates.headerHeight = n;
    }

    // Print settings
    if (body.algorithm !== undefined) updates.algorithm = body.algorithm;
    if (body.printBrightness !== undefined) updates.printBrightness = body.printBrightness;
    if (body.photoBorderId !== undefined) updates.photoBorderId = body.photoBorderId;
    if (body.photoFilter !== undefined) updates.photoFilter = body.photoFilter;

    // Feature flags — must be a plain object (not array, not string)
    if (body.features !== undefined) {
      if (
        typeof body.features !== "object" ||
        body.features === null ||
        Array.isArray(body.features)
      ) {
        return jsonError("features must be a plain object");
      }
      updates.features = JSON.stringify(body.features);
    }

    // Layout
    if (body.sectionOrder !== undefined) {
      if (!Array.isArray(body.sectionOrder)) {
        return jsonError("sectionOrder must be an array");
      }
      updates.sectionOrder = JSON.stringify(body.sectionOrder);
    }
    if (body.photoAspectRatio !== undefined) updates.photoAspectRatio = body.photoAspectRatio;

    // QR
    if (body.qrEnabled !== undefined) updates.qrEnabled = body.qrEnabled;
    if (body.qrUrl !== undefined) updates.qrUrl = body.qrUrl;
    if (body.qrCaption !== undefined) updates.qrCaption = body.qrCaption;

    // Stamps
    if (body.dateStampEnabled !== undefined) updates.dateStampEnabled = body.dateStampEnabled;
    if (body.timeStampEnabled !== undefined) updates.timeStampEnabled = body.timeStampEnabled;
    if (body.locationStampEnabled !== undefined) updates.locationStampEnabled = body.locationStampEnabled;
    if (body.locationText !== undefined) updates.locationText = body.locationText;

    // Memo defaults
    if (body.defaultMemo !== undefined) updates.defaultMemo = body.defaultMemo;
    if (body.memoFont !== undefined) updates.memoFont = body.memoFont;
    if (body.memoFontSize !== undefined) {
      const n = Number(body.memoFontSize);
      if (isNaN(n) || n < 1 || n > 200) return jsonError("memoFontSize must be 1–200");
      updates.memoFontSize = n;
    }

    // Event mode
    if (body.eventModeEnabled !== undefined) updates.eventModeEnabled = body.eventModeEnabled;
    if (body.eventName !== undefined) updates.eventName = body.eventName;
    if (body.eventDate !== undefined) updates.eventDate = body.eventDate;
    if (body.eventLocation !== undefined) updates.eventLocation = body.eventLocation;

    await db
      .update(cafeConfigs)
      .set(updates)
      .where(eq(cafeConfigs.cafeId, cafeId));

    const user = await getCurrentUser().catch(() => null);
    if (user) logAudit(user.id, cafeId, "config.update", { fields: Object.keys(updates) });

    return jsonOk({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
