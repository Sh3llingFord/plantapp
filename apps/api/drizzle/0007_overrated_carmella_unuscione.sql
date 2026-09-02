CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_digest_enabled` integer DEFAULT true NOT NULL,
	`quiet_hours_start` text DEFAULT '08:00' NOT NULL,
	`quiet_hours_end` text DEFAULT '21:00' NOT NULL,
	`last_digest_sent_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
