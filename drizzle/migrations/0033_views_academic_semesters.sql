ALTER TABLE `views` ADD `academic_year_id` integer REFERENCES `academic_years`(`id`) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `views` ADD `season` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_view_year_season` ON `views` (`academic_year_id`,`season`);
