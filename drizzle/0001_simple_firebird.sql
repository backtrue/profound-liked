CREATE TABLE `actionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`actionType` enum('content_gap','tech_seo','pr_outreach','trust_building') NOT NULL,
	`priority` enum('high','medium','low') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`tactic` text,
	`referenceSource` text,
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actionItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`errorMessage` text,
	CONSTRAINT `analysisSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brandMentions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`rankPosition` int,
	`sentimentScore` int NOT NULL,
	`isSarcastic` boolean NOT NULL DEFAULT false,
	`context` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brandMentions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `citationSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`url` text NOT NULL,
	`domain` varchar(255) NOT NULL,
	`sourceType` enum('ecommerce','forum','media','video','competitor','official','unknown') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `citationSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `derivativeQueries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seedKeywordId` int NOT NULL,
	`queryText` text NOT NULL,
	`generationType` enum('template','ai_creative') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `derivativeQueries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domainCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`category` enum('ecommerce','forum','media','video','competitor','official') NOT NULL,
	`market` enum('TW','JP','BOTH') NOT NULL DEFAULT 'BOTH',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `domainCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `domainCategories_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `engineResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`queryId` int NOT NULL,
	`engineId` int NOT NULL,
	`rawContent` text NOT NULL,
	`citations` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engineResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`targetMarket` enum('TW','JP') NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`competitors` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seedKeywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`searchVolume` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seedKeywords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `targetEngines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`engineName` varchar(100) NOT NULL,
	`modelVersion` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `targetEngines_id` PRIMARY KEY(`id`)
);
