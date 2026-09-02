CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`location_name` text,
	`latitude` real,
	`longitude` real,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `weather_cache` (
	`date` text PRIMARY KEY NOT NULL,
	`temp_min_c` real NOT NULL,
	`temp_max_c` real NOT NULL,
	`precipitation_sum_mm` real NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `task_occurrences` ADD `note` text;