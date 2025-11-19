CREATE TABLE `executionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`level` enum('info','warning','error') NOT NULL,
	`message` text NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executionLogs_id` PRIMARY KEY(`id`)
);
