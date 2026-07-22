CREATE TABLE `academic_years_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`fall` text NOT NULL,
	`spring` text NOT NULL,
	`added_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `academic_years_new` (`id`, `name`, `fall`, `spring`, `added_by_user_id`, `created_at`, `updated_at`)
SELECT
	`id`,
	`name`,
	'{"newStudentsMoveIn":null,"classesBegin":null,"classesEnd":null,"finalExamsStart":null,"finalExamsEnd":null,"holidays":[]}',
	'{"newStudentsMoveIn":null,"classesBegin":null,"classesEnd":null,"finalExamsStart":null,"finalExamsEnd":null,"holidays":[]}',
	`added_by_user_id`,
	`created_at`,
	`updated_at`
FROM `academic_years`;
--> statement-breakpoint
DROP TABLE `academic_years`;
--> statement-breakpoint
ALTER TABLE `academic_years_new` RENAME TO `academic_years`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_academic_year_name` ON `academic_years` (`name`);
