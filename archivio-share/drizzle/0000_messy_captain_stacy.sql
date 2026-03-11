CREATE TABLE `capsules` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`include_template` integer,
	`delivery_option` text,
	`deliver_at` integer,
	`status` text DEFAULT 'sealed',
	`delivered_at` integer,
	`cancel_token` text,
	`qstash_message_id` text,
	`email_template_id` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capsules_cancel_token_unique` ON `capsules` (`cancel_token`);--> statement-breakpoint
CREATE INDEX `capsules_deliver_at_status_idx` ON `capsules` (`deliver_at`,`status`);--> statement-breakpoint
CREATE INDEX `capsules_photo_id_idx` ON `capsules` (`photo_id`);--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` text PRIMARY KEY NOT NULL,
	`capsule_id` text,
	`event_type` text,
	`payload` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`subject` text,
	`heading` text,
	`body_html` text,
	`footer_text` text,
	`preview_text` text,
	`event_id` text,
	`is_active` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`date` text,
	`location` text,
	`organizer` text,
	`branding` text,
	`photo_expiry_days` integer DEFAULT 90,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`short_code` text,
	`status` text DEFAULT 'pending',
	`original_url` text,
	`thumbnail_url` text,
	`social_url` text,
	`file_size` integer,
	`width` integer,
	`height` integer,
	`expires_at` integer,
	`view_count` integer DEFAULT 0,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_short_code_unique` ON `photos` (`short_code`);--> statement-breakpoint
CREATE INDEX `photos_short_code_idx` ON `photos` (`short_code`);--> statement-breakpoint
CREATE INDEX `photos_event_id_idx` ON `photos` (`event_id`);--> statement-breakpoint
CREATE INDEX `photos_status_idx` ON `photos` (`status`);--> statement-breakpoint
CREATE INDEX `photos_expires_at_idx` ON `photos` (`expires_at`);