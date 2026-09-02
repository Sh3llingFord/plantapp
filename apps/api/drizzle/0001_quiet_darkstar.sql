CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`direction` text,
	`indoor` integer NOT NULL,
	`light_estimate` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plants` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`species_id` text,
	`free_text_species` text,
	`location_id` text,
	`purchase_date` integer,
	`notes` text,
	`photo_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`botanical_name` text NOT NULL,
	`care_profile` text NOT NULL,
	`light` text,
	`hardy` integer,
	`pets_toxic` integer,
	`indoor` integer,
	`outdoor` integer,
	`is_seed` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `species_botanical_name_unique` ON `species` (`botanical_name`);