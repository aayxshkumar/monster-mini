CREATE TABLE `cafes` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`updated_at` integer
);
--> statement-breakpoint
ALTER TABLE `photos` ADD `cafe_slug` text;--> statement-breakpoint
CREATE INDEX `photos_cafe_slug_idx` ON `photos` (`cafe_slug`);