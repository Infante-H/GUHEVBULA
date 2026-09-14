CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailEnabled` boolean NOT NULL DEFAULT true,
	`courseUpdates` boolean NOT NULL DEFAULT true,
	`assessmentUpdates` boolean NOT NULL DEFAULT true,
	`paymentUpdates` boolean NOT NULL DEFAULT true,
	`companyUpdates` boolean NOT NULL DEFAULT true,
	`securityUpdates` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_user_uidx` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;