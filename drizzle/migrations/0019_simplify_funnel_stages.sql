UPDATE `students`
SET `funnel_stage` = 'active'
WHERE `funnel_stage` IN ('new', 'reaching_out', 'connected', 'met');--> statement-breakpoint
ALTER TABLE `students` ALTER COLUMN "funnel_stage" TO "funnel_stage" text NOT NULL DEFAULT 'active';
