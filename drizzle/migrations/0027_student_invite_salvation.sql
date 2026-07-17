ALTER TABLE `students` ADD `invited_by_staff_id` integer REFERENCES `staff`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `students` ADD `event_invited_to_id` integer REFERENCES `events`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `students` ADD `led_to_christ_by_student_id` integer REFERENCES `students`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `students` ADD `led_to_christ_by_staff_id` integer REFERENCES `staff`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `students` ADD `salvation_decision_at` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `salvation_decision_notes` text;
