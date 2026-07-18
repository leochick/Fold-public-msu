ALTER TABLE `staff` ADD `starting_date` integer;--> statement-breakpoint
ALTER TABLE `staff` ADD `ending_date` integer;--> statement-breakpoint
ALTER TABLE `staff` ADD `spouse_id` integer REFERENCES `staff`(`id`) ON DELETE set null;
