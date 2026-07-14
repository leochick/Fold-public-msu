ALTER TABLE `groupings` ADD `event_and_student_data_view` integer REFERENCES `views`(`id`) ON DELETE set null;
