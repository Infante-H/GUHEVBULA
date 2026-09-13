CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`resource` varchar(120) NOT NULL,
	`resourceId` int,
	`result` varchar(40) NOT NULL DEFAULT 'success',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` MODIFY COLUMN `status` enum('pending','under_review','approved','rejected','suspended') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `companies` ADD `contactName` varchar(180);--> statement-breakpoint
ALTER TABLE `companies` ADD `contactEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `companies` ADD `phone` varchar(40);--> statement-breakpoint
ALTER TABLE `companies` ADD `employeeCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `company_course_assignments` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `company_course_assignments` ADD `dueAt` timestamp;--> statement-breakpoint
ALTER TABLE `company_course_assignments` ADD `status` enum('assigned','in_progress','completed','expired') DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_partnership_applications` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `company_partnership_applications` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_course_assignments` ADD CONSTRAINT `company_course_assignments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_partnership_applications` ADD CONSTRAINT `company_partnership_applications_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;