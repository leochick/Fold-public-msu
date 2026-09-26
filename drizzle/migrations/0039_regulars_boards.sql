CREATE TABLE `regulars_boards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`view_id` integer NOT NULL,
	`minimum_attendance` integer DEFAULT 2 NOT NULL,
	`containers` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`view_id`) REFERENCES `views`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_regulars_board_view` ON `regulars_boards` (`view_id`);
