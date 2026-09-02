PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plants` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`species_id` text,
	`free_text_species` text,
	`location_id` text,
	`purchase_date` integer,
	`notes` text,
	`photo_path` text,
	`care_profile_overrides` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_plants`("id", "nickname", "species_id", "free_text_species", "location_id", "purchase_date", "notes", "photo_path", "care_profile_overrides", "created_at") SELECT "id", "nickname", "species_id", "free_text_species", "location_id", "purchase_date", "notes", "photo_path", "care_profile_overrides", "created_at" FROM `plants`;--> statement-breakpoint
DROP TABLE `plants`;--> statement-breakpoint
ALTER TABLE `__new_plants` RENAME TO `plants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;