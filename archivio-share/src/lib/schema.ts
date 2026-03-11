import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ── Cafes (synced from archivio-platform) ────────────────
export const shareCafes = sqliteTable("cafes", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  updatedAt: integer("updated_at"),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  date: text("date"),
  location: text("location"),
  organizer: text("organizer"),
  branding: text("branding"),
  photoExpiryDays: integer("photo_expiry_days").default(90),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id"),
    cafeSlug: text("cafe_slug"),
    shortCode: text("short_code").unique(),
    status: text("status").default("pending"),
    originalUrl: text("original_url"),
    thumbnailUrl: text("thumbnail_url"),
    socialUrl: text("social_url"),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    expiresAt: integer("expires_at"),
    viewCount: integer("view_count").default(0),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("photos_short_code_idx").on(t.shortCode),
    index("photos_event_id_idx").on(t.eventId),
    index("photos_cafe_slug_idx").on(t.cafeSlug),
    index("photos_status_idx").on(t.status),
    index("photos_expires_at_idx").on(t.expiresAt),
  ]
);

export const capsules = sqliteTable(
  "capsules",
  {
    id: text("id").primaryKey(),
    photoId: text("photo_id").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    includeTemplate: integer("include_template", { mode: "boolean" }),
    deliveryOption: text("delivery_option"),
    deliverAt: integer("deliver_at"),
    status: text("status").default("sealed"),
    deliveredAt: integer("delivered_at"),
    cancelToken: text("cancel_token").unique(),
    qstashMessageId: text("qstash_message_id"),
    emailTemplateId: text("email_template_id"),
    createdAt: integer("created_at"),
  },
  (t) => [
    index("capsules_deliver_at_status_idx").on(t.deliverAt, t.status),
    index("capsules_photo_id_idx").on(t.photoId),
  ]
);

export const emailTemplates = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  name: text("name"),
  subject: text("subject"),
  heading: text("heading"),
  bodyHtml: text("body_html"),
  footerText: text("footer_text"),
  previewText: text("preview_text"),
  eventId: text("event_id"),
  isActive: integer("is_active", { mode: "boolean" }).default(false),
  createdAt: integer("created_at"),
  updatedAt: integer("updated_at"),
});

export const emailEvents = sqliteTable("email_events", {
  id: text("id").primaryKey(),
  capsuleId: text("capsule_id"),
  eventType: text("event_type"),
  payload: text("payload"),
  createdAt: integer("created_at"),
});

export const emailSelfLog = sqliteTable("email_self_log", {
  id: text("id").primaryKey(),
  photoId: text("photo_id").notNull(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});
