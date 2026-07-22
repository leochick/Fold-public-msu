CREATE TABLE `academic_years` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`new_students_move_in` integer,
	`classes_begin` integer,
	`classes_end` integer,
	`final_exams_start` integer,
	`final_exams_end` integer,
	`holidays` text NOT NULL,
	`added_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_academic_year_name` ON `academic_years` (`name`);
