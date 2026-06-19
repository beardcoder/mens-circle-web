CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`start_time` text DEFAULT '' NOT NULL,
	`end_time` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`location_details` text DEFAULT '' NOT NULL,
	`street` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`latitude` real,
	`longitude` real,
	`max_participants` integer DEFAULT 8 NOT NULL,
	`cost_basis` text DEFAULT '' NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`image_url` text,
	`listmonk_list_id` integer DEFAULT 0 NOT NULL,
	`deleted` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_date` ON `events` (`event_date`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_email` ON `participants` (`email`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text NOT NULL,
	`registered_at` text,
	`cancelled_at` text,
	`reminder_sent_at` text,
	`sms_reminder_sent_at` text,
	`deleted` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registrations_participant_event` ON `registrations` (`participant_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `idx_registrations_event` ON `registrations` (`event_id`);--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`quote` text NOT NULL,
	`author_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`published_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
