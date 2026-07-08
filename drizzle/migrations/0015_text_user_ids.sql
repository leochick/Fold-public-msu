PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `users__new` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`name` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `users__new` (`id`, `email`, `password`, `name`, `email_verified`, `image`, `created_at`, `updated_at`)
SELECT cast(`id` as text), `email`, `password_hash`, `display_name`, `email_verified`, `image`, `created_at`, `updated_at`
FROM `users`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `users__new` RENAME TO `users`;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `sessions__new` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `sessions__new` (`id`, `token`, `user_id`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at`)
SELECT `id`, `token`, cast(`user_id` as text), `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at`
FROM `sessions`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
ALTER TABLE `sessions__new` RENAME TO `sessions`;
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
--> statement-breakpoint
CREATE TABLE `account__new` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `account__new` (`id`, `account_id`, `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`)
SELECT `id`, `account_id`, `provider_id`, cast(`user_id` as text), `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`
FROM `account`;
--> statement-breakpoint
DROP TABLE `account`;
--> statement-breakpoint
ALTER TABLE `account__new` RENAME TO `account`;
--> statement-breakpoint
CREATE TABLE `attendances__new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`event_id` integer NOT NULL,
	`recorded_by` text,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`notes` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `attendances__new` (`id`, `student_id`, `event_id`, `recorded_by`, `recorded_at`, `notes`)
SELECT `id`, `student_id`, `event_id`, cast(`recorded_by` as text), `recorded_at`, `notes`
FROM `attendances`;
--> statement-breakpoint
DROP TABLE `attendances`;
--> statement-breakpoint
ALTER TABLE `attendances__new` RENAME TO `attendances`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_student_event` ON `attendances` (`student_id`,`event_id`);
--> statement-breakpoint
CREATE TABLE `feedback__new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`text` text NOT NULL,
	`page` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `feedback__new` (`id`, `user_id`, `text`, `page`, `created_at`)
SELECT `id`, cast(`user_id` as text), `text`, `page`, `created_at`
FROM `feedback`;
--> statement-breakpoint
DROP TABLE `feedback`;
--> statement-breakpoint
ALTER TABLE `feedback__new` RENAME TO `feedback`;
--> statement-breakpoint
CREATE TABLE `contact_attempts__new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`attempted_by_user_id` text,
	`channel` text NOT NULL,
	`channel_detail` text,
	`attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`responded` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `contact_attempts__new` (`id`, `student_id`, `attempted_by_user_id`, `channel`, `channel_detail`, `attempted_at`, `responded`, `notes`, `created_at`)
SELECT `id`, `student_id`, cast(`attempted_by_user_id` as text), `channel`, `channel_detail`, `attempted_at`, `responded`, `notes`, `created_at`
FROM `contact_attempts`;
--> statement-breakpoint
DROP TABLE `contact_attempts`;
--> statement-breakpoint
ALTER TABLE `contact_attempts__new` RENAME TO `contact_attempts`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
