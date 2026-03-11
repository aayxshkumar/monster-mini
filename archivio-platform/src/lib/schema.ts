import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ── Cafes ────────────────────────────────────────────────
export const cafes = sqliteTable(
  "cafes",
  {
    id: text("id").primaryKey(), // nanoid
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(), // URL-safe, e.g. "blue-bottle-sf"
    logoUrl: text("logo_url"),
    piServerUrl: text("pi_server_url"), // e.g. "http://192.168.1.50:5000"
    plan: text("plan").default("free").notNull(), // "free" | "pro" | "enterprise"
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  // slug already has .unique() constraint — creates its own index
);

// ── Users (linked to Supabase auth) ─────────────────────
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // nanoid
    supabaseId: text("supabase_id").unique().notNull(), // Supabase auth user ID
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(), // "super_admin" | "cafe_admin" | "cafe_operator"
    cafeId: text("cafe_id"), // null for super_admin, FK to cafes.id
    avatarUrl: text("avatar_url"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    // supabaseId already has .unique() — creates its own index
    uniqueIndex("users_email_unique_idx").on(t.email),
    index("users_cafe_id_idx").on(t.cafeId),
  ]
);

// ── Cafe Configs (controls what operators see + locked settings) ──
export const cafeConfigs = sqliteTable("cafe_configs", {
  cafeId: text("cafe_id").primaryKey(), // FK to cafes.id, 1:1

  // Branding
  logoUrl: text("logo_url"),
  headerText: text("header_text").default(""),
  headerTextFont: text("header_text_font").default("Inter"),
  headerTextSize: integer("header_text_size").default(12),
  headerTextBold: integer("header_text_bold", { mode: "boolean" }).default(false),
  headerTextItalic: integer("header_text_italic", { mode: "boolean" }).default(false),
  headerHeight: integer("header_height").default(64),

  // Print settings
  algorithm: text("algorithm").default("atkinson"),
  printBrightness: text("print_brightness").default("medium"),
  photoBorderId: text("photo_border_id").default("none"),
  photoFilter: text("photo_filter").default("none"),

  // Feature flags (JSON)
  features: text("features").notNull(), // JSON stringified CafeFeatureFlags

  // Layout
  sectionOrder: text("section_order").default('["logo","photo","memo","qr","stamp"]'),
  photoAspectRatio: text("photo_aspect_ratio").default("free"),

  // QR
  qrEnabled: integer("qr_enabled", { mode: "boolean" }).default(false),
  qrUrl: text("qr_url").default(""),
  qrCaption: text("qr_caption").default(""),

  // Stamps
  dateStampEnabled: integer("date_stamp_enabled", { mode: "boolean" }).default(false),
  timeStampEnabled: integer("time_stamp_enabled", { mode: "boolean" }).default(false),
  locationStampEnabled: integer("location_stamp_enabled", { mode: "boolean" }).default(false),
  locationText: text("location_text").default(""),

  // Memo defaults
  defaultMemo: text("default_memo").default(""),
  memoFont: text("memo_font").default("Inter"),
  memoFontSize: integer("memo_font_size").default(14),

  // Event mode
  eventModeEnabled: integer("event_mode_enabled", { mode: "boolean" }).default(false),
  eventName: text("event_name").default(""),
  eventDate: text("event_date").default(""),
  eventLocation: text("event_location").default(""),

  updatedAt: integer("updated_at").notNull(),
});

// ── Cafe Templates (locked designs operators can select) ──
export const cafeTemplates = sqliteTable(
  "cafe_templates",
  {
    id: text("id").primaryKey(), // nanoid
    cafeId: text("cafe_id").notNull(), // FK to cafes.id
    name: text("name").notNull(),
    description: text("description").default(""),
    thumbnailUrl: text("thumbnail_url"),
    state: text("state").notNull(), // Full JSON serialized booth-store state
    lockedFields: text("locked_fields").default("[]"), // JSON array of field names operator can't change
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("cafe_templates_cafe_id_idx").on(t.cafeId),
    index("cafe_templates_default_idx").on(t.cafeId, t.isDefault),
  ]
);

// ── Audit log (track admin actions) ──────────────────────
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    cafeId: text("cafe_id"),
    action: text("action").notNull(), // e.g. "cafe.create", "config.update", "template.lock"
    details: text("details"), // JSON stringified context
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("audit_log_cafe_id_idx").on(t.cafeId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ]
);
