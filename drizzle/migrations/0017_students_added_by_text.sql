PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `students__new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text,
	`student_id` text,
	`gender` text,
	`year` text,
	`phone` text,
	`email` text,
	`ig_handle` text,
	`member_status` text,
	`is_active` integer DEFAULT true NOT NULL,
	`newsletter` integer DEFAULT false NOT NULL,
	`groupme` integer DEFAULT false NOT NULL,
	`contacted_via_ig` integer DEFAULT false NOT NULL,
	`primary_contact` text,
	`goals` text,
	`notes` text,
	`course_material` text,
	`added_by_user_id` text,
	`first_met_context` text,
	`first_met_at` integer,
	`funnel_stage` text DEFAULT 'new' NOT NULL,
	`invited_by_student_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invited_by_student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `students__new` (
	`id`, `first_name`, `last_name`, `student_id`, `gender`, `year`, `phone`, `email`, `ig_handle`,
	`member_status`, `is_active`, `newsletter`, `groupme`, `contacted_via_ig`, `primary_contact`,
	`goals`, `notes`, `course_material`, `added_by_user_id`, `first_met_context`, `first_met_at`,
	`funnel_stage`, `invited_by_student_id`, `created_at`, `updated_at`
)
SELECT
	`id`, `first_name`, `last_name`, `student_id`, `gender`, `year`, `phone`, `email`, `ig_handle`,
	`member_status`, `is_active`, `newsletter`, `groupme`, `contacted_via_ig`, `primary_contact`,
	`goals`, `notes`, `course_material`, cast(`added_by_user_id` as text), `first_met_context`, `first_met_at`,
	`funnel_stage`, `invited_by_student_id`, `created_at`, `updated_at`
FROM `students`;
--> statement-breakpoint
DROP TABLE `students`;
--> statement-breakpoint
ALTER TABLE `students__new` RENAME TO `students`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
