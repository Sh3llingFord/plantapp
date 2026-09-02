CREATE TABLE `garden_plan_cells` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`row` integer NOT NULL,
	`col` integer NOT NULL,
	`species_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `garden_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `garden_plan_cells_plan_id_row_col_unique` ON `garden_plan_cells` (`plan_id`,`row`,`col`);--> statement-breakpoint
CREATE TABLE `garden_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`rows` integer NOT NULL,
	`cols` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
