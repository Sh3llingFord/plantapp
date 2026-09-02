CREATE TABLE `enrichment_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`plant_id` text,
	`status` text NOT NULL,
	`result_species_id` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`result_species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `species_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`care_profile` text NOT NULL,
	`schema_version` integer NOT NULL,
	`prompt_version` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `species` ADD `photo_path` text;