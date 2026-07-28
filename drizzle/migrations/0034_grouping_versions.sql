CREATE TABLE `grouping_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grouping_id` integer NOT NULL,
	`name` text NOT NULL,
	`checked_event_ids` text,
	`include_newsletter_contacts` integer DEFAULT false NOT NULL,
	`containers` text NOT NULL,
	`added_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`grouping_id`) REFERENCES `groupings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
