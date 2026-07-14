-- Move all groupings under the 2027 Fall view while keeping their event/student
-- data sourced from 2026 Spring (where those events and students currently live).
UPDATE `groupings`
SET
	`event_and_student_data_view` = (
		SELECT `id` FROM `views` WHERE `name` = '2026 Spring Semester' LIMIT 1
	),
	`view_id` = (
		SELECT `id` FROM `views` WHERE `name` = '2027 Fall Semester (incl. Summer before)' LIMIT 1
	),
	`updated_at` = unixepoch()
WHERE
	EXISTS (SELECT 1 FROM `views` WHERE `name` = '2026 Spring Semester')
	AND EXISTS (SELECT 1 FROM `views` WHERE `name` = '2027 Fall Semester (incl. Summer before)');
