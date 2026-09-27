ALTER TABLE `students` ADD `christian_status` text;--> statement-breakpoint
UPDATE `students` SET `christian_status` = 'christian' WHERE `christian` = 1;--> statement-breakpoint
ALTER TABLE `students` DROP COLUMN `christian`;--> statement-breakpoint
ALTER TABLE `students` RENAME COLUMN `christian_status` TO `christian`;
