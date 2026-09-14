CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`status` enum('pending','processing','paid','failed','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`provider` varchar(80) NOT NULL DEFAULT 'manual_pending',
	`transactionId` varchar(180),
	`receiptFileKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_transactionId_unique` UNIQUE(`transactionId`)
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `promotionalPrice` decimal(10,2);--> statement-breakpoint
ALTER TABLE `courses` ADD `pricingType` enum('free','paid') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `commercialStatus` enum('available','hidden','retired') DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`userId`);--> statement-breakpoint
CREATE INDEX `payments_course_idx` ON `payments` (`courseId`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);