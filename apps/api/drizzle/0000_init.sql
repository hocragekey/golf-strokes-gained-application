CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tees` text DEFAULT '' NOT NULL,
	`holes` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hole_entries` (
	`round_id` text NOT NULL,
	`hole_number` integer NOT NULL,
	`score` integer NOT NULL,
	`tee_result` text,
	`approach_yards` integer,
	`approach_lie` text NOT NULL,
	`gir` integer NOT NULL,
	`miss_direction` text,
	`short_game_shots` integer NOT NULL,
	`short_game_yards` integer,
	`short_game_lie` text,
	`first_putt_feet` integer,
	`putts` integer NOT NULL,
	`penalties` integer NOT NULL,
	PRIMARY KEY(`round_id`, `hole_number`),
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`played_on` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `rounds_played_on_idx` ON `rounds` (`played_on`);--> statement-breakpoint
CREATE INDEX `rounds_course_idx` ON `rounds` (`course_id`);