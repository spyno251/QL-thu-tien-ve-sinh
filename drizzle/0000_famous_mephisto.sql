CREATE TABLE `apartments` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`code` text NOT NULL,
	`owner` text NOT NULL,
	`monthly_fee` integer,
	FOREIGN KEY (`block_id`) REFERENCES `blocks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`region_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`apartment_id` text NOT NULL,
	`collector_id` text NOT NULL,
	`month` text NOT NULL,
	`paid_at` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`apartment_id`) REFERENCES `apartments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collector_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`default_fee` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);