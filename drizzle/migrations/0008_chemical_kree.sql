CREATE TABLE `demo_spend` (
	`id` text PRIMARY KEY NOT NULL,
	`spent_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
