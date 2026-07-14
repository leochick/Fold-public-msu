CREATE TABLE `role_boards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`view_id` integer NOT NULL,
	`event_and_student_data_view` integer,
	`person_column_count` integer DEFAULT 0 NOT NULL,
	`rows` text NOT NULL,
	`added_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `views`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_and_student_data_view`) REFERENCES `views`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_role_board_view` ON `role_boards` (`view_id`);
