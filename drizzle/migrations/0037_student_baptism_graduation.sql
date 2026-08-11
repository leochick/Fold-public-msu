ALTER TABLE `students` ADD `graduation_year` integer;--> statement-breakpoint
ALTER TABLE `students` ADD `baptism_date` integer;--> statement-breakpoint
UPDATE `students` SET `graduation_year` = 2029 WHERE `year` = 'sophomore';--> statement-breakpoint
UPDATE `students` SET `graduation_year` = 2028 WHERE `year` = 'junior';--> statement-breakpoint
UPDATE `students` SET `graduation_year` = 2026 WHERE `year` = 'senior';
