CREATE TABLE `changelog_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`action` text NOT NULL,
	`entity_label` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `changelog_entries_created_at_idx` ON `changelog_entries` (`created_at`);
